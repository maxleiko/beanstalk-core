import { Socket } from 'net';
import { EventEmitter } from 'events';
import { IPutOptions, IReleaseOptions } from './types';
import { parse, S, Msg, Using, AnyError, Released, Deleted, Inserted, Ok } from './protocol';
import { BeanstalkError } from './error';

const PUT_DEFAULT: IPutOptions = { priority: 0, delay: 0, ttr: 60 };

export default class BeanstalkClient {
  private _socket: Socket;
  private _pendingRequests: EventEmitter[];

  constructor() {
    this._socket = new Socket();
    this._pendingRequests = [];

    this._socket.on('data', (chunk) => {
      const messages = parse(chunk);
      for (const msg of messages) {
        const pending = this._pendingRequests.pop();
        if (pending) {
          pending.emit('resolve', msg);
        }
      }
    });
  }

  async connect(host = 'localhost', port = 11300): Promise<void> {
    return new Promise((resolve, reject) => {
      const errorHandler = (err: Error) => reject(err);
      this._socket.once('error', errorHandler);
      this._socket.connect(port, host, () => {
        this._socket.off('error', errorHandler);
        resolve();
      });
    });
  }

  /**
   * The quit command simply closes the connection. Its form is:
   * 
   *     quit\r\n
   */
  quit(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket.write(`quit\r\n`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * The "put" command is for any process that wants to insert a job into the queue.
   * It comprises a command line followed by the job body:
   *
   *     put <pri> <delay> <ttr> <bytes>\r\n
   *     <data>\r\n
   *
   * It inserts a job into the client's currently used tube (see the "use" command
   * below).
   *
   *  - <pri> is an integer < 2**32. Jobs with smaller priority values will be
   *    scheduled before jobs with larger priorities. The most urgent priority is 0;
   *    the least urgent priority is 4,294,967,295.
   *
   *  - <delay> is an integer number of seconds to wait before putting the job in
   *    the ready queue. The job will be in the "delayed" state during this time.
   *    Maximum delay is 2**32-1.
   *
   *  - <ttr> -- time to run -- is an integer number of seconds to allow a worker
   *    to run this job. This time is counted from the moment a worker reserves
   *    this job. If the worker does not delete, release, or bury the job within
   *    <ttr> seconds, the job will time out and the server will release the job.
   *    The minimum ttr is 1. If the client sends 0, the server will silently
   *    increase the ttr to 1. Maximum ttr is 2**32-1.
   *
   *  - <bytes> is an integer indicating the size of the job body, not including the
   *    trailing "\r\n". This value must be less than max-job-size (default: 2**16).
   *
   *  - <data> is the job body -- a sequence of bytes of length <bytes> from the
   *    previous line.
   *
   * After sending the command line and body, the client waits for a reply, which
   * may be:
   *
   *  - "INSERTED <id>\r\n" to indicate success.
   *
   *    - <id> is the integer id of the new job
   *
   *  - "BURIED <id>\r\n" if the server ran out of memory trying to grow the
   *    priority queue data structure.
   *
   *    - <id> is the integer id of the new job
   *
   *  - "EXPECTED_CRLF\r\n" The job body must be followed by a CR-LF pair, that is,
   *    "\r\n". These two bytes are not counted in the job size given by the client
   *    in the put command line.
   *
   *  - "JOB_TOO_BIG\r\n" The client has requested to put a job with a body larger
   *    than max-job-size bytes.
   *
   *  - "DRAINING\r\n" This means that the server has been put into "drain mode" and
   *    is no longer accepting new jobs. The client should try another server or
   *    disconnect and try again later. To put the server in drain mode, send the
   *    SIGUSR1 signal to the process.
   *
   * @param payload
   * @param opts
   */
  async put(payload: Buffer | string, opts: IPutOptions = PUT_DEFAULT): Promise<number> {
    payload = typeof payload === 'string' ? Buffer.from(payload) : payload;
    const head = Buffer.from(
      `put ${opts.priority} ${opts.delay} ${opts.ttr} ${payload.byteLength}\r\n`
    );
    const tail = Buffer.from('\r\n');
    const cmd = Buffer.concat([head, payload, tail]);
    const res = await this._send<Inserted>(cmd);
    if (res.code === S.INSERTED) {
      return res.value;
    }
    throw new BeanstalkError('Unable to put a new job', res.code);
  }

  /**
   * The "use" command is for producers. Subsequent put commands will put jobs into
   * the tube specified by this command. If no use command has been issued, jobs
   * will be put into the tube named "default".
   *
   *     use <tube>\r\n
   *
   * - <tube> is a name at most 200 bytes. It specifies the tube to use. If the
   *   tube does not exist, it will be created.
   *
   * The only reply is:
   *
   *     USING <tube>\r\n
   *
   * - <tube> is the name of the tube now being used.
   *
   * @param tube
   */
  async use(tube: string): Promise<string> {
    const cmd = Buffer.from(`use ${tube}\r\n`);
    const res = await this._send<Using>(cmd);
    if (res.code === S.USING) {
      return res.value;
    }
    throw new BeanstalkError(`Unable to use tube '${tube}'`, res.code);
  }

  /**
   * The delete command removes a job from the server entirely. It is normally used
   * by the client when the job has successfully run to completion. A client can
   * delete jobs that it has reserved, ready jobs, delayed jobs, and jobs that are
   * buried. The delete command looks like this:
   *
   *     delete <id>\r\n
   *
   * - <id> is the job id to delete.
   *
   * The client then waits for one line of response, which may be:
   *
   * - "DELETED\r\n" to indicate success.
   *
   * - "NOT_FOUND\r\n" if the job does not exist or is not either reserved by the
   *    client, ready, or buried. This could happen if the job timed out before the
   *    client sent the delete command.
   * 
   * @param id
   */
  async delete(id: number): Promise<void> {
    const cmd = Buffer.from(`delete ${id}\r\n`);
    const res = await this._send<Deleted>(cmd);
    if (res.code === S.DELETED) {
      return;
    }
    throw new BeanstalkError(`Unable to delete job id '${id}'`, res.code);
  }

  /**
   * The release command puts a reserved job back into the ready queue (and marks
   * its state as "ready") to be run by any client. It is normally used when the job
   * fails because of a transitory error. It looks like this:
   * 
   *     release <id> <pri> <delay>\r\n
   * 
   *  - <id> is the job id to release.
   * 
   *  - <pri> is a new priority to assign to the job.
   * 
   *  - <delay> is an integer number of seconds to wait before putting the job in
   *    the ready queue. The job will be in the "delayed" state during this time.
   * 
   * The client expects one line of response, which may be:
   * 
   *  - "RELEASED\r\n" to indicate success.
   * 
   *  - "BURIED\r\n" if the server ran out of memory trying to grow the priority
   *    queue data structure.
   * 
   *  - "NOT_FOUND\r\n" if the job does not exist or is not reserved by the client.
   * 
   * @param id 
   * @param opts
   */
  async release(id: number, opts: IReleaseOptions): Promise<void> {
    const cmd = Buffer.from(`release ${id} ${opts.priority} ${opts.delay}\r\n`);
    const res = await this._send<Released>(cmd);
    if (res.code === S.RELEASED) {
      return;
    }
    throw new BeanstalkError(`Unable to release job id '${id}'`, res.code);
  }

  /**
   * The list-tubes-watched command returns a list tubes currently being watched by
   * the client. Its form is:
   * 
   *     list-tubes-watched\r\n
   * 
   * The response is:
   * 
   *     OK <bytes>\r\n
   *     <data>\r\n
   * 
   *  - <bytes> is the size of the following data section in bytes.
   * 
   *  - <data> is a sequence of bytes of length <bytes> from the previous line. It
   *    is a YAML file containing watched tube names as a list of strings.
   */
  async listTubesWatched(): Promise<string[]> {
    const cmd = Buffer.from('list-tubes-watched\r\n');
    const res = await this._send<Ok>(cmd);
    if (res.code === S.OK) {
      return res.value;
    }
    throw new BeanstalkError(`Unable to list watched tubes`, res.code);
  }

  private async _send<M = Msg>(cmd: Buffer): Promise<M | AnyError> {
    const emitter = new EventEmitter();
    // FIXME consider adding a global timeout option to prevent infinite hanging on answers
    const resultPromise = new Promise<M | AnyError>((resolve, reject) => {
      emitter.on('resolve', resolve);
      emitter.on('reject', reject);
    });

    this._pendingRequests.push(emitter);

    await this._write(cmd);
    return resultPromise;
  }

  private async _write(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket.write(data, (err) => (err ? reject(err) : resolve()));
    });
  }
}
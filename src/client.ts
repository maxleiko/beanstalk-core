import { Socket } from 'net';
import { EventEmitter } from 'events';
import { IPutOptions, IReleaseOptions, Msg } from './types';
import { BeanstalkError } from './error';
import { M, parse } from './protocol';
import { yamlList, yamlMap } from './yaml-parser';
import { ParseContext } from './internal_types';

const PUT_DEFAULT: IPutOptions = { priority: 0, delay: 0, ttr: 60 };
const REL_DEFAULT: IReleaseOptions = { priority: 0, delay: 0 };

export class BeanstalkClient {
  private _connected: boolean;
  private _socket: Socket;
  private _pendingRequests: EventEmitter[];

  constructor() {
    this._connected = false;
    this._socket = new Socket();
    this._pendingRequests = [];

    const messages: Msg[] = [];
    const ctx = new ParseContext();
    this._socket.on('data', (chunk) => {
      ctx.append(chunk);
      try {
        parse(ctx, messages);
        while (messages.length > 0) {
          const emitter = this._pendingRequests.shift();
          if (emitter) {
            const msg = messages.shift();
            emitter.emit('resolve', msg);
          }
        }
      } catch (err) {
        const emitter = this._pendingRequests.shift();
        if (emitter) {
          emitter.emit('reject', err);
        }
      }
    });
  }

  /**
   *
   * @param host beanstalkd host (defaults to `localhost`)
   * @param port beanstalkd port (defaults to `11300`)
   * @param timeout connection timeout in milliseconds (defaults to `-1` = no timeout)
   */
  async connect(host = 'localhost', port = 11300, timeout = -1): Promise<void> {
    return new Promise((resolve, reject) => {
      const connectHandler = () => {
        // when connected: remove error/timeout handlers
        this._socket.off('error', errorHandler);
        this._socket.off('timeout', timeoutHandler);

        // set inner state
        this._connected = true;

        resolve();
      };
      const errorHandler = (err: Error) => {
        // when an error occurs: remove connect/timeout handlers
        this._socket.off('connect', connectHandler);
        this._socket.off('timeout', timeoutHandler);

        // set inner state
        this._connected = false;

        reject(err);
      };
      const timeoutHandler = () => {
        // when connection times out: trigger error
        this._socket.destroy(new Error('Connection timeout'));
      };

      if (timeout > 0) {
        this._socket.setTimeout(timeout);
        this._socket.once('timeout', timeoutHandler);
      }
      this._socket.once('connect', connectHandler);
      this._socket.once('error', errorHandler);
      this._socket.connect(port, host);
    });
  }

  /**
   * The quit command simply closes the connection. Its form is:
   *
   *     quit\r\n
   */
  quit(): void {
    this._socket.write(`quit\r\n`);
    this._socket.destroy();
    this._connected = false;
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
   * @param opts if undefined; defaults to `{ priority: 0, delay: 0, ttr: 60 }`
   */
  async put(payload: Buffer | string, opts: IPutOptions = PUT_DEFAULT): Promise<number> {
    payload = typeof payload === 'string' ? Buffer.from(payload) : payload;
    const head = Buffer.from(`put ${opts.priority} ${opts.delay} ${opts.ttr} ${payload.byteLength}\r\n`);
    const tail = Buffer.from('\r\n');
    const cmd = Buffer.concat([head, payload, tail]);
    const res = await this._send(cmd);

    switch (res.code) {
      case M.INSERTED:
        return res.value;
      case M.BURIED:
        // XXX is this really considered an error?
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        throw new BeanstalkError(`Job '${res.value!}' has been put in the buried queue`, res.code);
      default:
        throw new BeanstalkError('Unable to put a new job', res.code);
    }
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
    const res = await this._send(cmd);
    if (res.code === M.USING) {
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
    const res = await this._send(cmd);
    if (res.code === M.DELETED) {
      return;
    }
    throw new BeanstalkError(`Unable to delete job id '${id}'`, res.code);
  }

  /**
   * A process that wants to consume jobs from the queue uses "reserve", "delete",
   * "release", and "bury". The first worker command, "reserve", looks like this:
   *
   *     reserve\r\n
   *
   * Alternatively, you can specify a timeout as follows:
   *
   *     reserve-with-timeout <seconds>\r\n
   *
   * This will return a newly-reserved job. If no job is available to be reserved,
   * beanstalkd will wait to send a response until one becomes available. Once a
   * job is reserved for the client, the client has limited time to run (TTR) the
   * job before the job times out. When the job times out, the server will put the
   * job back into the ready queue. Both the TTR and the actual time left can be
   * found in response to the stats-job command.
   *
   * If more than one job is ready, beanstalkd will choose the one with the
   * smallest priority value. Within each priority, it will choose the one that
   * was received first.
   *
   * A timeout value of 0 will cause the server to immediately return either a
   * response or TIMED_OUT.  A positive value of timeout will limit the amount of
   * time the client will block on the reserve request until a job becomes
   * available.
   *
   * During the TTR of a reserved job, the last second is kept by the server as a
   * safety margin, during which the client will not be made to wait for another
   * job. If the client issues a reserve command during the safety margin, or if
   * the safety margin arrives while the client is waiting on a reserve command,
   * the server will respond with:
   *
   *     DEADLINE_SOON\r\n
   *
   * This gives the client a chance to delete or release its reserved job before
   * the server automatically releases it.
   *
   *     TIMED_OUT\r\n
   *
   * If a non-negative timeout was specified and the timeout exceeded before a job
   * became available, or if the client's connection is half-closed, the server
   * will respond with TIMED_OUT.
   *
   * Otherwise, the only other response to this command is a successful reservation
   * in the form of a text line followed by the job body:
   *
   *     RESERVED <id> <bytes>\r\n
   *     <data>\r\n
   *
   *  - <id> is the job id -- an integer unique to this job in this instance of
   *    beanstalkd.
   *
   *  - <bytes> is an integer indicating the size of the job body, not including
   *    the trailing "\r\n".
   *
   *  - <data> is the job body -- a sequence of bytes of length <bytes> from the
   *    previous line. This is a verbatim copy of the bytes that were originally
   *    sent to the server in the put command for this job.
   *
   * @param timeout
   * @returns {[number, Buffer]} `res` with `res[0]` being the `id` and `res[1]` being the `payload`
   */
  async reserve(timeout?: number): Promise<[number, Buffer]> {
    const withTimeout = typeof timeout === 'number';
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    const cmd = withTimeout ? Buffer.from(`reserve-with-timeout ${timeout}\r\n`) : Buffer.from('reserve\r\n');
    const res = await this._send(cmd);
    if (res.code === M.RESERVED) {
      return res.value;
    }
    throw new BeanstalkError('Unable to reserve a job', res.code);
  }

  /**
   * A job can be reserved by its id. Once a job is reserved for the client,
   * the client has limited time to run (TTR) the job before the job times out.
   * When the job times out, the server will put the job back into the ready queue.
   * The command looks like this:
   *
   *     reserve-job <id>\r\n
   *
   *  - <id> is the job id to reserve
   *
   * This should immediately return one of these responses:
   *
   * - `NOT_FOUND\r\n` if the job does not exist or reserved by a client or
   *   is not either ready, buried or delayed.
   *
   * - `RESERVED <id> <bytes>\r\n<data>\r\n`. See the description for
   *   the reserve command.
   *
   * @param id
   */
  // async reserveJob(id: number): Promise<[number, Buffer]> {
  //   const cmd = Buffer.from(`reserve-job ${id}\r\n`);
  //   const res = await this._send(cmd);
  //   if (res.code === S.RESERVED) {
  //     return res.value;
  //   }
  //   throw new BeanstalkError(`Unable to reserve job id '${id}'`, res.code);
  // }

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
   * @param opts if undefined; defaults to `{ priority: 0, delay: 0 }`
   */
  async release(id: number, opts: IReleaseOptions = REL_DEFAULT): Promise<void> {
    const cmd = Buffer.from(`release ${id} ${opts.priority} ${opts.delay}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.RELEASED) {
      return;
    }
    throw new BeanstalkError(`Unable to release job id '${id}'`, res.code);
  }

  /**
   * The "watch" command adds the named tube to the watch list for the current
   * connection. A reserve command will take a job from any of the tubes in the
   * watch list. For each new connection, the watch list initially consists of one
   * tube, named "default".
   *
   *     watch <tube>\r\n
   *
   *  - <tube> is a name at most 200 bytes. It specifies a tube to add to the watch
   *    list. If the tube doesn't exist, it will be created.
   *
   * The reply is:
   *
   *     WATCHING <count>\r\n
   *
   *  - <count> is the integer number of tubes currently in the watch list.
   *
   * @param tube
   */
  async watch(tube: string): Promise<number> {
    const cmd = Buffer.from(`watch ${tube}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.WATCHING) {
      return res.value;
    }
    throw new BeanstalkError(`Unable to watch tube '${tube}'`, res.code);
  }

  /**
   * The "ignore" command is for consumers. It removes the named tube from the
   * watch list for the current connection.
   *
   *     ignore <tube>\r\n
   *
   * The reply is one of:
   *
   *  - "WATCHING <count>\r\n" to indicate success.
   *
   *    - <count> is the integer number of tubes currently in the watch list.
   *
   *  - "NOT_IGNORED\r\n" if the client attempts to ignore the only tube in its
   *    watch list.
   *
   * @param tube
   */
  async ignore(tube: string): Promise<number> {
    const cmd = Buffer.from(`ignore ${tube}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.WATCHING) {
      return res.value;
    }
    throw new BeanstalkError(`Unable to ignore tube '${tube}'`, res.code);
  }

  /**
   * The peek commands let the client inspect a job in the system.
   *
   *  - "peek <id>\r\n" - return job <id>.
   *
   * There are two possible responses, either a single line:
   *
   *  - "NOT_FOUND\r\n" if the requested job doesn't exist or there are no jobs in
   *    the requested state.
   *
   * Or a line followed by a chunk of data, if the command was successful:
   *
   *     FOUND <id> <bytes>\r\n
   *     <data>\r\n
   *
   *  - <id> is the job id.
   *
   *  - <bytes> is an integer indicating the size of the job body, not including
   *    the trailing "\r\n".
   *
   *  - <data> is the job body -- a sequence of bytes of length <bytes> from the
   *    previous line.
   *
   * @param id
   */
  async peek(id: number): Promise<[number, Buffer]> {
    const cmd = Buffer.from(`peek ${id}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.FOUND) {
      return res.value;
    }
    throw new BeanstalkError(`Unable to peek job id '${id}'`, res.code);
  }

  /**
   * The peek-ready command let the client inspect a job in the currently used tube.
   *
   *  - "peek-ready\r\n" - return the next ready job.
   *
   * There are two possible responses, either a single line:
   *
   *  - "NOT_FOUND\r\n" if the requested job doesn't exist or there are no jobs in
   *    the requested state.
   *
   * Or a line followed by a chunk of data, if the command was successful:
   *
   *     FOUND <id> <bytes>\r\n
   *     <data>\r\n
   *
   *  - <id> is the job id.
   *
   *  - <bytes> is an integer indicating the size of the job body, not including
   *    the trailing "\r\n".
   *
   *  - <data> is the job body -- a sequence of bytes of length <bytes> from the
   *    previous line.
   *
   */
  async peekReady(): Promise<[number, Buffer]> {
    const cmd = Buffer.from(`peek-ready\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.FOUND) {
      return res.value;
    }
    throw new BeanstalkError('Unable to peek the next ready job', res.code);
  }

  /**
   * The peek-delayed command let the client inspect a job in the currently used tube.
   *
   *  - "peek-delayed\r\n" - return the delayed job with the shortest delay left.
   *
   * There are two possible responses, either a single line:
   *
   *  - "NOT_FOUND\r\n" if the requested job doesn't exist or there are no jobs in
   *    the requested state.
   *
   * Or a line followed by a chunk of data, if the command was successful:
   *
   *     FOUND <id> <bytes>\r\n
   *     <data>\r\n
   *
   *  - <id> is the job id.
   *
   *  - <bytes> is an integer indicating the size of the job body, not including
   *    the trailing "\r\n".
   *
   *  - <data> is the job body -- a sequence of bytes of length <bytes> from the
   *    previous line.
   *
   */
  async peekDelayed(): Promise<[number, Buffer]> {
    const cmd = Buffer.from(`peek-delayed\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.FOUND) {
      return res.value;
    }
    throw new BeanstalkError('Unable to peek the delayed job with the shortest delay left', res.code);
  }

  /**
   * The peek-buried command let the client inspect a job in the currently used tube.
   *
   *  - "peek-buried\r\n" - return the next job in the list of buried jobs.
   *
   * There are two possible responses, either a single line:
   *
   *  - "NOT_FOUND\r\n" if the requested job doesn't exist or there are no jobs in
   *    the requested state.
   *
   * Or a line followed by a chunk of data, if the command was successful:
   *
   *     FOUND <id> <bytes>\r\n
   *     <data>\r\n
   *
   *  - <id> is the job id.
   *
   *  - <bytes> is an integer indicating the size of the job body, not including
   *    the trailing "\r\n".
   *
   *  - <data> is the job body -- a sequence of bytes of length <bytes> from the
   *    previous line.
   *
   */
  async peekBuried(): Promise<[number, Buffer]> {
    const cmd = Buffer.from(`peek-buried\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.FOUND) {
      return res.value;
    }
    throw new BeanstalkError('Unable to peek the next job in the list of buried jobs', res.code);
  }

  /**
   * The kick command applies only to the currently used tube. It moves jobs into
   * the ready queue. If there are any buried jobs, it will only kick buried jobs.
   * Otherwise it will kick delayed jobs. It looks like:
   *
   *     kick <bound>\r\n
   *
   *  - <bound> is an integer upper bound on the number of jobs to kick. The server
   *    will kick no more than <bound> jobs.
   *
   * The response is of the form:
   *
   *     KICKED <count>\r\n
   *
   *  - <count> is an integer indicating the number of jobs actually kicked.
   *
   * @param bound
   */
  async kick(bound: number): Promise<number> {
    const cmd = Buffer.from(`kick ${bound}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.KICKED) {
      return res.value as number;
    }
    throw new BeanstalkError('Unable to kick jobs', res.code);
  }

  /**
   * The kick-job command is a variant of kick that operates with a single job
   * identified by its job id. If the given job id exists and is in a buried or
   * delayed state, it will be moved to the ready queue of the the same tube where it
   * currently belongs. The syntax is:
   *
   *     kick-job <id>\r\n
   *
   *  - <id> is the job id to kick.
   *
   * The response is one of:
   *
   *  - "NOT_FOUND\r\n" if the job does not exist or is not in a kickable state. This
   *    can also happen upon internal errors.
   *
   *  - "KICKED\r\n" when the operation succeeded.
   *
   * @param id
   */
  async kickJob(id: number): Promise<void> {
    const cmd = Buffer.from(`kick-job ${id}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.KICKED) {
      return;
    }
    throw new BeanstalkError(`Unable to kick job id '${id}'`, res.code);
  }

  /**
   * The stats-tube command gives statistical information about the specified tube
   * if it exists. Its form is:
   *
   *     stats-tube <tube>\r\n
   *
   *  - <tube> is a name at most 200 bytes. Stats will be returned for this tube.
   *
   * The response is one of:
   *
   *  - "NOT_FOUND\r\n" if the tube does not exist.
   *
   *  - "OK <bytes>\r\n<data>\r\n"
   *
   *    - <bytes> is the size of the following data section in bytes.
   *
   *    - <data> is a sequence of bytes of length <bytes> from the previous line. It
   *      is a YAML file with statistical information represented by a dictionary.
   *
   * @param tube
   */
  async statsTube(tube: string): Promise<Record<string, string | number | boolean>> {
    const cmd = Buffer.from(`stats-tube ${tube}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.OK) {
      return yamlMap(res.value);
    }
    throw new BeanstalkError(`Unable to stats tube '${tube}'`, res.code);
  }

  /**
   * The stats-job command gives statistical information about the specified job if
   * it exists. Its form is:
   *
   *     stats-job <id>\r\n
   *
   *  - <id> is a job id.
   *
   * The response is one of:
   *
   *  - "NOT_FOUND\r\n" if the job does not exist.
   *
   *  - "OK <bytes>\r\n<data>\r\n"
   *
   *    - <bytes> is the size of the following data section in bytes.
   *
   *    - <data> is a sequence of bytes of length <bytes> from the previous line. It
   *      is a YAML file with statistical information represented by a dictionary.
   *
   * @param id
   */
  async statsJob(id: number): Promise<Record<string, string | number | boolean>> {
    const cmd = Buffer.from(`stats-job ${id}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.OK) {
      return yamlMap(res.value);
    }
    throw new BeanstalkError(`Unable to stats job id '${id}'`, res.code);
  }

  /**
   * The stats command gives statistical information about the system as a whole.
   * Its form is:
   *
   *     stats\r\n
   *
   * The server will respond:
   *
   *     OK <bytes>\r\n
   *     <data>\r\n
   *
   *  - <bytes> is the size of the following data section in bytes.
   *
   *  - <data> is a sequence of bytes of length <bytes> from the previous line. It
   *    is a YAML file with statistical information represented by a dictionary.
   */
  async stats(): Promise<Record<string, string | number | boolean>> {
    const cmd = Buffer.from(`stats\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.OK) {
      return yamlMap(res.value);
    }
    throw new BeanstalkError('Unable to stats the system', res.code);
  }

  /**
   * The list-tubes command returns a list of all existing tubes. Its form is:
   *
   *     list-tubes\r\n
   *
   * The response is:
   *
   *     OK <bytes>\r\n
   *     <data>\r\n
   *
   *  - <bytes> is the size of the following data section in bytes.
   *
   *  - <data> is a sequence of bytes of length <bytes> from the previous line. It
   *    is a YAML file containing all tube names as a list of strings.
   */
  async listTubes(): Promise<string[]> {
    const cmd = Buffer.from('list-tubes\r\n');
    const res = await this._send(cmd);
    if (res.code === M.OK) {
      return yamlList(res.value);
    }
    throw new BeanstalkError('Unable to list tubes', res.code);
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
    const res = await this._send(cmd);
    if (res.code === M.OK) {
      return yamlList(res.value);
    }
    throw new BeanstalkError('Unable to list watched tubes', res.code);
  }

  /**
   * The list-tube-used command returns the tube currently being used by the
   * client. Its form is:
   *
   *     list-tube-used\r\n
   *
   * The response is:
   *
   *     USING <tube>\r\n
   *
   *  - <tube> is the name of the tube being used.
   *
   */
  async listTubeUsed(): Promise<string> {
    const cmd = Buffer.from('list-tube-used\r\n');
    const res = await this._send(cmd);
    if (res.code === M.USING) {
      return res.value;
    }
    throw new BeanstalkError('Unable to list used tube', res.code);
  }

  /**
   * The pause-tube command can delay any new job being reserved for a given time. Its form is:
   *
   *     pause-tube <tube-name> <delay>\r\n
   *
   *  - <tube> is the tube to pause
   *
   *  - <delay> is an integer number of seconds < 2**32 to wait before reserving any more
   *    jobs from the queue
   *
   * There are two possible responses:
   *
   *  - "PAUSED\r\n" to indicate success.
   *
   *  - "NOT_FOUND\r\n" if the tube does not exist.
   *
   * @param tube
   */
  async pause(tube: string, delay: number): Promise<void> {
    const cmd = Buffer.from(`pause-tube ${tube} ${delay}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.PAUSED) {
      return;
    }
    throw new BeanstalkError(`Unable to pause tube '${tube}'`, res.code);
  }

  /**
   * The "touch" command allows a worker to request more time to work on a job.
   * This is useful for jobs that potentially take a long time, but you still want
   * the benefits of a TTR pulling a job away from an unresponsive worker.  A worker
   * may periodically tell the server that it's still alive and processing a job
   * (e.g. it may do this on DEADLINE_SOON). The command postpones the auto
   * release of a reserved job until TTR seconds from when the command is issued.
   *
   * The touch command looks like this:
   *
   *     touch <id>\r\n
   *
   *  - <id> is the ID of a job reserved by the current connection.
   *
   * There are two possible responses:
   *
   *  - "TOUCHED\r\n" to indicate success.
   *
   *  - "NOT_FOUND\r\n" if the job does not exist or is not reserved by the client.
   *
   * @param id
   */
  async touch(id: number): Promise<void> {
    const cmd = Buffer.from(`touch ${id}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.TOUCHED) {
      return;
    }
    throw new BeanstalkError(`Unable to touch job id '${id}'`, res.code);
  }

  /**
   * The bury command puts a job into the "buried" state. Buried jobs are put into a
   * FIFO linked list and will not be touched by the server again until a client
   * kicks them with the "kick" command.
   *
   * The bury command looks like this:
   *
   *     bury <id> <pri>\r\n
   *
   *  - <id> is the job id to bury.
   *
   *  - <pri> is a new priority to assign to the job.
   *
   * There are two possible responses:
   *
   *  - "BURIED\r\n" to indicate success.
   *
   *  - "NOT_FOUND\r\n" if the job does not exist or is not reserved by the client.
   *
   * @param id
   * @param priority
   */
  async bury(id: number, priority = 1024): Promise<void> {
    const cmd = Buffer.from(`bury ${id} ${priority}\r\n`);
    const res = await this._send(cmd);
    if (res.code === M.BURIED) {
      return;
    }
    throw new BeanstalkError(`Unable to bury job id '${id}'`, res.code);
  }

  private async _send(cmd: Buffer): Promise<Msg> {
    if (!this._connected) {
      throw new Error(`Beanstalk client is not connected to a server.`);
    }

    const emitter = new EventEmitter();

    const resultPromise = new Promise<Msg>((resolve, reject) => {
      emitter.once('resolve', resolve);
      emitter.once('reject', reject);
    });

    this._pendingRequests.push(emitter);

    // FIXME consider adding a global timeout option to prevent infinite hanging on answers
    // or maybe we want to hang indefinitely?
    try {
      this._socket.write(cmd);
    } catch (err) {
      // if an error occured while writing to socket then no response will ever
      // be received, so the pending request will never dequeue: remove it
      this._pendingRequests.splice(this._pendingRequests.indexOf(emitter), 1);
      // re-throw error
      throw err;
    }

    return resultPromise;
  }
}
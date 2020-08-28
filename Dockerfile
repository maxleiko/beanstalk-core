FROM          node:12.9.1-alpine
RUN           mkdir -p /home/node/app
WORKDIR       /home/node/app
COPY          package.json /home/node/app
RUN           yarn
COPY          . /home/node/app
RUN           yarn package

FROM          alpine:3.12.0
COPY --from=0 /home/node/app/bsc /usr/local/bin/
ENV           NODE_ENV=production
ENTRYPOINT    [ "bsc" ]

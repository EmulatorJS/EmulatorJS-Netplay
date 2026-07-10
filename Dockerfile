#Build container
FROM alpine:latest AS build

RUN apk add --no-cache cargo

RUN mkdir /build
WORKDIR /build
COPY ./ /build

RUN cargo build -r


#Runtime container
FROM alpine:latest

RUN apk add --no-cache libgcc

COPY --from=build --chmod=777 /build/target/release/rust-socket-server /

RUN adduser -D -H netplayserver
USER netplayserver

ENV PORT=4000
EXPOSE 4000/tcp

ENTRYPOINT [ "/rust-socket-server" ]

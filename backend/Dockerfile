# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Pre-copy go.mod and go.sum for layer caching
COPY go.mod go.sum ./
RUN go mod download -x

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server

# Final stage
FROM alpine:3.19

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

COPY --from=builder /app/server .
COPY .env.example .env

EXPOSE 8080

CMD ["./server"]

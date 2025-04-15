import time

class ThrottledStream:
    def __init__(self, stream, chunk_size=1024, delay=0.01):
        self.stream = stream
        self.chunk_size = chunk_size
        self.delay = delay

    def read(self, size=-1):
        if size < 0 or size > self.chunk_size:
            size = self.chunk_size
        time.sleep(self.delay)
        return self.stream.read(size)

    def seek(self, offset, whence=0):
        return self.stream.seek(offset, whence)

    def tell(self):
        return self.stream.tell()

    def close(self):
        return self.stream.close()
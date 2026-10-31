// Share an outstanding request across effect restarts. Never keep a camera
// running between attendance sessions just to retain a temporary permission.
type CameraRequest = { promise: Promise<MediaStream>; users: number; stream?: MediaStream };
let current: CameraRequest | undefined;

export function acquireAttendanceCamera() {
  if (!current) {
    const request: CameraRequest = {
      users: 0,
      promise: navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      }),
    };
    current = request;
    request.promise = request.promise.then(stream => {
      request.stream = stream;
      if (request.users === 0) {
        stream.getTracks().forEach(track => track.stop());
        if (current === request) current = undefined;
      }
      return stream;
    }, error => {
      if (current === request) current = undefined;
      throw error;
    });
  }
  const request = current;
  request.users += 1;
  let released = false;
  return {
    ready: request.promise,
    release() {
      if (released) return;
      released = true;
      request.users -= 1;
      // React's development setup/cleanup/setup can reuse the same request.
      queueMicrotask(() => {
        if (request.users === 0 && request.stream) {
          request.stream.getTracks().forEach(track => track.stop());
          if (current === request) current = undefined;
        }
      });
    },
  };
}

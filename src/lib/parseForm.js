import { IncomingForm } from "formidable";
import { Readable } from "stream";

// This disables Next.js default body parsing

function toNodeRequest(request) {
  const reader = request.body.getReader();
  const stream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) this.push(null);
      else this.push(value);
    },
  });

  // Create a fake req for formidable
  return Object.assign(stream, {
    headers: Object.fromEntries(request.headers), // Convert Headers to plain object
    method: request.method,
    url: request.url,
  });
}

export async function parseFormData(request) {
  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: false });

    const nodeReq = toNodeRequest(request);

    form.parse(nodeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

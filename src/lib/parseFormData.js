// lib/parseFormData.js
import { IncomingForm } from "formidable";
import { Readable } from "stream";

// Important: Disable body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// Convert Web Request to Node Stream
function toNodeRequest(request) {
  const reader = request.body.getReader();
  const stream = new Readable({
    async read() {
      const { done, value } = await reader.read();
      if (done) this.push(null);
      else this.push(value);
    },
  });

  // Attach headers and other info
  return Object.assign(stream, {
    headers: Object.fromEntries(request.headers),
    method: request.method,
    url: request.url,
  });
}

// Main parser
export async function parseFormData(request) {
  const nodeReq = toNodeRequest(request);

  return new Promise((resolve, reject) => {
    const form = new IncomingForm({ multiples: true, keepExtensions: true });
    form.parse(nodeReq, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

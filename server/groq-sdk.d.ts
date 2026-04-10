/** Minimal typing so `tsc` passes when groq-sdk is not installed (optional runtime). */
declare module "groq-sdk" {
  export default class Groq {
    constructor(options: { apiKey?: string });
    chat: {
      completions: {
        create: (args: unknown) => Promise<unknown>;
      };
    };
  }
}

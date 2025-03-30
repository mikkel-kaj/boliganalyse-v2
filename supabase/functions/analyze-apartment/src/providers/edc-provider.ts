import {JsonLdProvider} from "./json-ld-provider.ts";

export class EdcProvider extends JsonLdProvider {
  override get name(): string {
    return "EdcProvider";
  }

  override canHandle(url: string, htmlContent?: string): boolean {
    return url.includes("edc.dk") && super.canHandle(url, htmlContent);
  }
}

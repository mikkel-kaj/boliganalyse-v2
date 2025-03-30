import { HTMLParseResult } from "../types/index.ts";
import {BaseProvider} from "./base-provider.ts";
import {FirecrawlProvider} from "./firecrawl-provider.ts";
import {extractDomain} from "../utils/url.ts";
import { createLogger } from "../utils/logger.ts";


export class DanboligProvider extends FirecrawlProvider {

    override logger = createLogger("DanboligProvider");

    override get name(): string {
        return "Danbolig";
    }

    override canHandle(url: string, htmlContent?: string): boolean {
        try {
            const domain = extractDomain(url);
            return domain === "danbolig.dk";
        } catch {
            return false;
        }
    }

    override async parseHtml(url: string, htmlContent: string): Promise<HTMLParseResult> {
        const result = await super.parseHtml(url, htmlContent);

        // Ensure extractedText is not undefined before processing
        if (result.extractedText) {
            // Process the markdown to remove unnecessary text
            const cleanedMarkdown = this.cleanMarkdown(result.extractedText);
            
            // Update the result with the cleaned markdown
            result.extractedText = cleanedMarkdown;
            
        } else {
            this.logger.warn("No extracted text to process");
        }
        
        return result;
    }
    
    /**
     * Process Danbolig markdown to remove unnecessary text
     * @param markdown Original markdown text
     * @returns Cleaned markdown text
     */
    private cleanMarkdown(markdown: string): string {
        // Find the occurrences of specified text blocks
        const startMarker = "Kun nødvendige formålOK til valgteTilpas";
        const endMarker = "## Kontakt os";
        
        // Use sensible defaults if markers not found
        const startIndex = markdown.lastIndexOf(startMarker);
        const effectiveStartIndex = startIndex !== -1 ? 
            startIndex + startMarker.length : 0;
            
        const endIndex = markdown.lastIndexOf(endMarker);
        const effectiveEndIndex = endIndex !== -1 ? 
            endIndex : markdown.length;
        
        // Extract the content based on effective indexes
        return markdown.substring(effectiveStartIndex, effectiveEndIndex).trim();
    }
}

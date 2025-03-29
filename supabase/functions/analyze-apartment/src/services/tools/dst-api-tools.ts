import { createLogger } from "../../utils/logger.ts";
import { ToolDefinition } from "../../types/tool-calling.ts";
import { BaseTool } from "../base-tool.ts";

const logger = createLogger("DSTTools");

// Base URL for Danmarks Statistik API
const BASE_URL = "https://api.statbank.dk/v1";

// Types for Danmarks Statistik API
type DataFormat = "JSONSTAT" | "JSON" | "CSV" | "XLSX" | "BULK" | "PX" | "TSV" | "HTML5" | "HTML5InclNotes";
type TimeOrder = "Ascending" | "Descending";
type ValuePresentation = "Code" | "Text";
type Language = "da" | "en";

interface DSTVariable {
  code: string;
  values: string[];
}

/**
 * Tool definition for get_subjects
 */
export const GET_SUBJECTS_TOOL_DEFINITION: ToolDefinition = {
  name: "get_subjects",
  description: "Get subjects from Danmarks Statistik API. Returns a list of subjects or sub-subjects.",
  input_schema: {
    type: "object",
    properties: {
      subjects: {
        type: "array",
        description: "Optional list of subject codes. If provided, fetches sub-subjects for these subjects.",
        items: {
          type: "string"
        }
      },
      includeTables: {
        type: "boolean",
        description: "If true, includes tables in the result under each subject."
      },
      recursive: {
        type: "boolean",
        description: "If true, fetches sub-subjects (and tables) recursively through all levels."
      },
      omitInactiveSubjects: {
        type: "boolean",
        description: "If true, omits subjects/sub-subjects that are no longer updated."
      },
      lang: {
        type: "string",
        description: "Language code ('da' or 'en', default 'da').",
        enum: ["da", "en"]
      }
    },
    required: []
  }
};

/**
 * Tool definition for get_tables
 */
export const GET_TABLES_TOOL_DEFINITION: ToolDefinition = {
  name: "get_tables",
  description: "Get tables from Danmarks Statistik API. Returns a list of tables, optionally filtered by subjects.",
  input_schema: {
    type: "object",
    properties: {
      subjects: {
        type: "array",
        description: "Optional list of subject codes to filter tables on.",
        items: {
          type: "string"
        }
      },
      pastdays: {
        type: "number",
        description: "Optional number of days; only tables updated within these days are included."
      },
      includeInactive: {
        type: "boolean",
        description: "If true, includes inactive (discontinued) tables."
      },
      lang: {
        type: "string",
        description: "Language code ('da' or 'en', default 'da').",
        enum: ["da", "en"]
      }
    },
    required: []
  }
};

/**
 * Tool definition for get_table_info
 */
export const GET_TABLE_INFO_TOOL_DEFINITION: ToolDefinition = {
  name: "get_table_info",
  description: "Get table metadata from Danmarks Statistik API. Returns detailed information about a specific table.",
  input_schema: {
    type: "object",
    properties: {
      table_id: {
        type: "string",
        description: "The table code (e.g., 'folk1c')."
      },
      lang: {
        type: "string",
        description: "Language code ('da' or 'en', default 'da').",
        enum: ["da", "en"]
      }
    },
    required: ["table_id"]
  }
};

/**
 * Tool definition for get_data
 */
export const GET_DATA_TOOL_DEFINITION: ToolDefinition = {
  name: "get_data",
  description: "Get data from Danmarks Statistik API. Returns data from a specific table, optionally filtered by variables.",
  input_schema: {
    type: "object",
    properties: {
      table_id: {
        type: "string",
        description: "The table code (e.g., 'folk1c')."
      },
      variables: {
        type: "array",
        description: "Optional list of dicts to filter data. Each dict must have 'code' (variable code) and 'values' (list of desired value codes).",
        items: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Variable code"
            },
            values: {
              type: "array",
              description: "List of desired value codes",
              items: {
                type: "string"
              }
            }
          }
        }
      },
      format: {
        type: "string",
        description: "Output format. Default 'JSONSTAT'.",
        enum: ["JSONSTAT", "JSON", "CSV", "XLSX", "BULK", "PX", "TSV", "HTML5", "HTML5InclNotes"]
      },
      timeOrder: {
        type: "string",
        description: "Optional string for sorting time series ('Ascending' or 'Descending').",
        enum: ["Ascending", "Descending"]
      },
      valuePresentation: {
        type: "string",
        description: "Optional string to control value presentation ('Code' or 'Text').",
        enum: ["Code", "Text"]
      },
      lang: {
        type: "string",
        description: "Language code for metadata in result ('da' or 'en', default 'da').",
        enum: ["da", "en"]
      }
    },
    required: ["table_id"]
  }
};

/**
 * Implementation of get_subjects tool
 */
export class GetSubjectsTool extends BaseTool {
  constructor() {
    super(GET_SUBJECTS_TOOL_DEFINITION);
  }

  protected async executeImpl(params: Record<string, any>): Promise<string> {
    const { subjects, includeTables = false, recursive = false, omitInactiveSubjects = false, lang = "da" } = params;
    
    const payload: Record<string, any> = { 
      format: "JSON", 
      lang 
    };
    
    if (subjects) {
      payload.subjects = subjects;
    }
    
    if (includeTables) {
      payload.includeTables = true;
    }
    
    if (recursive) {
      payload.recursive = true;
    }
    
    if (omitInactiveSubjects) {
      payload.omitInactiveSubjects = true;
    }
    
    try {
      logger.info(`Fetching subjects from DST API: ${JSON.stringify(payload)}`);
      const response = await fetch(`${BASE_URL}/subjects`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`DST API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return JSON.stringify(data);
    } catch (error) {
      logger.error("Error fetching subjects from DST API:", error);
      throw error;
    }
  }
}

/**
 * Implementation of get_tables tool
 */
export class GetTablesTool extends BaseTool {
  constructor() {
    super(GET_TABLES_TOOL_DEFINITION);
  }

  protected async executeImpl(params: Record<string, any>): Promise<string> {
    const { subjects, pastdays, includeInactive = false, lang = "da" } = params;
    
    const payload: Record<string, any> = { 
      format: "JSON", 
      lang 
    };
    
    if (subjects) {
      payload.subjects = subjects;
    }
    
    if (pastdays !== undefined && pastdays !== null) {
      payload.pastdays = pastdays;
    }
    
    if (includeInactive) {
      payload.includeInactive = true;
    }
    
    try {
      logger.info(`Fetching tables from DST API: ${JSON.stringify(payload)}`);
      const response = await fetch(`${BASE_URL}/tables`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`DST API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return JSON.stringify(data);
    } catch (error) {
      logger.error("Error fetching tables from DST API:", error);
      throw error;
    }
  }
}

/**
 * Implementation of get_table_info tool
 */
export class GetTableInfoTool extends BaseTool {
  constructor() {
    super(GET_TABLE_INFO_TOOL_DEFINITION);
  }

  protected async executeImpl(params: Record<string, any>): Promise<string> {
    const { table_id, lang = "da" } = params;
    
    const payload = { 
      table: table_id, 
      format: "JSON", 
      lang 
    };
    
    try {
      logger.info(`Fetching table info from DST API for table ${table_id}`);
      const response = await fetch(`${BASE_URL}/tableinfo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`DST API Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return JSON.stringify(data);
    } catch (error) {
      logger.error(`Error fetching table info for ${table_id} from DST API:`, error);
      throw error;
    }
  }
}

/**
 * Implementation of get_data tool
 */
export class GetDataTool extends BaseTool {
  constructor() {
    super(GET_DATA_TOOL_DEFINITION);
  }

  protected async executeImpl(params: Record<string, any>): Promise<string> {
    const { 
      table_id, 
      variables, 
      format = "JSONSTAT", 
      timeOrder, 
      valuePresentation, 
      lang = "da" 
    } = params;
    
    // Build the basic payload
    const payload: Record<string, any> = {
      table: table_id,
      format: format.toUpperCase(),
      lang
    };
    
    // Handle variables - ensure proper structure
    if (variables) {
      // Ensure each variable has required structure
      for (const variable of variables) {
        if (!variable.code || !variable.values) {
          throw new Error("Each variable must have 'code' and 'values' properties");
        }
        
        // Convert single value to array if needed
        if (!Array.isArray(variable.values)) {
          variable.values = [variable.values];
        }
      }
      
      payload.variables = variables;
    }
    
    // Add optional parameters if provided
    if (timeOrder) {
      payload.timeOrder = timeOrder;
    }
    
    if (valuePresentation) {
      payload.valuePresentation = valuePresentation;
    }
    
    try {
      logger.info(`Fetching data from DST API for table ${table_id}: ${JSON.stringify(payload)}`);
      const response = await fetch(`${BASE_URL}/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`DST API Error: ${response.status} ${response.statusText}`);
      }
      
      // Handle different response formats
      const formatUpper = format.toUpperCase();
      if (formatUpper === "JSON" || formatUpper === "JSONSTAT") {
        const data = await response.json();
        return JSON.stringify(data);
      } else if (["CSV", "PX", "TSV", "HTML5", "HTML5INCLNOTES"].includes(formatUpper)) {
        const text = await response.text();
        return text;
      } else {
        // For binary formats like XLSX, convert to base64
        const arrayBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const binary = bytes.reduce((data, byte) => data + String.fromCharCode(byte), '');
        const base64 = btoa(binary);
        return `data:application/${formatUpper.toLowerCase()};base64,${base64}`;
      }
    } catch (error) {
      logger.error(`Error fetching data for table ${table_id} from DST API:`, error);
      throw error;
    }
  }
} 
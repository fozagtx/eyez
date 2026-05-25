#!/usr/bin/env node
import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createEyezMcpServer } from "./mcpTools.js";

const server = createEyezMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);

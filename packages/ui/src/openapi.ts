import { HTTP_PORT, HTTPS_PORT, HOST } from "@restroom-mw/utils";
import { ls, nl2br } from "./utils";
import { Zencode } from "@restroom-mw/zencode";
import { OpenAPI } from "./interfaces";

let openapi: OpenAPI = {
  openapi: "3.0.3",
  info: {
    title: "Restroom",
    version: "1.0.0",
    description: `This is a simple API autogenerated from a folder within your server.

To add new endpoints you should add new zencode contracts in the directory.

**NB** The files should be in form of \`endpoint.zen\` then your contract will run on \`/endpoint\`
    `,
    termsOfService: "https://zenroom.org/privacy",
    contact: {
      email: "dev@dyne.org",
    },
    license: {
      name: "GNU Affero General Public License v3.0 or later",
      url: "https://www.gnu.org/licenses/agpl-3.0",
    },
  },
  servers: [
    {
      description: "development local server",
      url: "{protocol}://{host}:{port}/{basePath}",
      variables: {
        port: {
          enum: [HTTP_PORT, HTTPS_PORT],
          default: HTTP_PORT,
        },
        protocol: { enum: ["http", "https"], default: "http" },
        host: { default: HOST },
        basePath: { default: "api" },
      },
    },
  ],
  schemes: ["http"],
  paths: {},
};

/**
 * Generates an openapi definition out of the contracts in `ZENCODE_DIR`
 * @param {string} rootPath root folder directory to look for the swagger generation
 * @see {@link http://spec.openapis.org/oas/v3.0.3|Openapi Specs}
 */
export const generate = async (rootPath: string) => {
  const paths = await ls(rootPath);
  const mime = ["application/json"];
  const requestBody = {
    content: {
      "application/json": {
        schema: {
          properties: {
            data: {
              description: "DATA field",
              type: "object",
            },
            keys: {
              description: "KEYS field",
              type: "object",
            },
          },
        },
      },
    },
  };
  const responses = {
    200: {
      description: "Successful Response",
      content: {
        "application/json": {
          schema: {},
        },
      },
    },
    500: {
      description: "Error Response",
      content: {
        "text/plain; charset=utf-8": {
          schema: {},
        },
      },
    },
  };

  openapi.paths = {};
  for (const path in paths) {
    const contract = Zencode.fromPath(paths[path].fullPath);
    const isChain = paths[path].type == 'yml' ? true : false
    const tag = isChain ? '⛓️ chain of contracts' : `🔖 ${contract.tag}`;
    const exposedPath = isChain ? `${path}.chain` : path;

    let endpoint = {
      post: {
        summary: contract.summary,
        description: nl2br(contract.content),
        tags: [`${tag}`],
        consumes: mime,
        produces: mime,
        operationId: `_function_${exposedPath}_post`,
        requestBody,
        responses,
      },
    };

    openapi.paths[`/${exposedPath}`] = endpoint;

  }

  return openapi;
};

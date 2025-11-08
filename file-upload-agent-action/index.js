// File: index.js
const AWS = require("aws-sdk");

// Configurar AWS SDK
const s3 = new AWS.S3();

// Utilitários
const generateTraceId = () => `trace-${Date.now()}`;

const logEnvironment = (traceId) => {
  console.log(`[${traceId}] Environment:`, {
    AWS_REGION: process.env.AWS_REGION,
    STAGE: process.env.STAGE,
    NODE_ENV: process.env.NODE_ENV,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  });
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

exports.handler = async (event) => {
  try {
    const traceId = generateTraceId();
    logEnvironment(traceId);

    console.log(`[${traceId}] Received event:`, JSON.stringify(event, null, 2));

    // Detectar versão do API Gateway e extrair método HTTP
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;

    // Handle CORS preflight requests
    if (httpMethod === "OPTIONS") {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: "CORS preflight response" }),
      };
    }

    // Verificar se o método é POST
    if (httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Method not allowed",
          message: "Only POST method is supported",
        }),
      };
    }

    // Parse do body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      console.error(`[${traceId}] Error parsing request body:`, error);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Invalid JSON",
          message: "Request body must be valid JSON",
        }),
      };
    }

    // Validar campos obrigatórios
    let { fileName, fileContent, contentType, content, html } = requestBody;

    // Flexibilidade: aceitar 'content' como alias para 'fileContent'
    if (!fileContent && content) {
      fileContent = content;
    }

    // Flexibilidade: aceitar 'html' para conteúdo HTML direto
    if (!fileContent && html) {
      fileContent = html;
      if (!fileName) fileName = "index.html";
      if (!contentType) contentType = "text/html";
    }

    if (!fileContent) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Missing required fields",
          message: "fileContent, content, or html is required",
          requiredFields: ["fileContent OR content OR html"],
          optionalFields: ["fileName", "contentType"],
          examples: {
            "HTML direct": {
              html: "<html>...</html>",
              fileName: "my-page.html",
            },
            "Base64 file": { fileName: "doc.pdf", fileContent: "base64string" },
            "Text content": { fileName: "notes.txt", content: "My notes" },
          },
        }),
      };
    }

    // Auto-gerar fileName se não fornecido
    if (!fileName) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      // Detectar tipo pelo conteúdo
      if (
        fileContent.trim().startsWith("<html") ||
        fileContent.trim().startsWith("<!DOCTYPE")
      ) {
        fileName = `generated-${timestamp}.html`;
      } else if (fileContent.startsWith("{") || fileContent.startsWith("[")) {
        fileName = `data-${timestamp}.json`;
      } else {
        fileName = `file-${timestamp}.txt`;
      }
    }

    // Extrair extensão do arquivo
    const fileExtension =
      fileName && fileName.includes(".") ? fileName.split(".").pop() : "";

    console.log(`[${traceId}] File extension extracted:`, fileExtension);
    console.log(`[${traceId}] Generated fileName:`, fileName);
    console.log(`[${traceId}] Version: 1.0.2 - Enhanced ChatGPT compatibility`);

    // Usar nome fixo para substituir o arquivo anterior
    // Se for HTML, sempre salvar como index.html na raiz
    let s3Key;
    let finalFileName;

    if (
      fileName.toLowerCase().endsWith(".html") ||
      fileName.toLowerCase() === "index"
    ) {
      s3Key = "index.html";
      finalFileName = "index.html";
    } else {
      // Para outros tipos, manter o nome original (substituirá se existir)
      finalFileName = fileName;
      s3Key = fileName;
    }

    // Determinar Content-Type
    let finalContentType = contentType || "application/octet-stream";

    // Auto-detectar content type baseado na extensão se não fornecido
    if (!contentType && fileExtension) {
      const contentTypeMap = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        pdf: "application/pdf",
        txt: "text/plain",
        html: "text/html",
        css: "text/css",
        js: "application/javascript",
        json: "application/json",
        xml: "application/xml",
        zip: "application/zip",
        mp4: "video/mp4",
        mp3: "audio/mpeg",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      finalContentType =
        contentTypeMap[fileExtension.toLowerCase()] ||
        "application/octet-stream";
    }

    // Converter conteúdo para buffer (suporte base64 e texto direto)
    let fileBuffer;
    let isBase64 = false;

    try {
      // Verificar se é base64 válido (mais rigoroso)
      const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
      const cleanContent = fileContent.replace(/\s/g, "");

      // Base64 deve ter pelo menos 4 caracteres e ser múltiplo de 4 (após padding)
      const isLikelyBase64 =
        base64Pattern.test(cleanContent) &&
        cleanContent.length >= 4 &&
        cleanContent.length % 4 === 0 &&
        !cleanContent.includes("<") && // HTML não é base64
        !cleanContent.includes("{") && // JSON não é base64
        cleanContent.length > 20; // Base64 real geralmente é mais longo

      if (isLikelyBase64) {
        try {
          // Tentar decodificar como base64 e verificar se o resultado faz sentido
          fileBuffer = Buffer.from(fileContent, "base64");
          isBase64 = true;
          console.log(
            `[${traceId}] Content decoded as base64, size: ${fileBuffer.length} bytes`
          );
        } catch (base64Error) {
          // Se falhar na decodificação, tratar como texto
          fileBuffer = Buffer.from(fileContent, "utf8");
          console.log(`[${traceId}] Base64 decode failed, treating as text`);
        }
      } else {
        // Tratar como texto direto
        fileBuffer = Buffer.from(fileContent, "utf8");
        console.log(`[${traceId}] Content treated as direct text`);
      }
    } catch (error) {
      console.error(`[${traceId}] Error processing file content:`, error);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Invalid file content",
          message:
            "Failed to process file content. Ensure content is valid base64 or plain text",
          details: error.message,
        }),
      };
    }

    console.log(`[${traceId}] Uploading file to S3:`, {
      bucket: process.env.S3_BUCKET_NAME,
      key: s3Key,
      contentType: finalContentType,
      size: fileBuffer.length,
    });

    // Upload para S3
    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: finalContentType,
      // ACL removido - usando bucket policy para acesso público
      Metadata: {
        "original-filename": fileName,
        "uploaded-at": new Date().toISOString(),
        "trace-id": traceId,
      },
    };

    const uploadResult = await s3.upload(uploadParams).promise();

    console.log(`[${traceId}] File uploaded successfully:`, {
      location: uploadResult.Location,
      etag: uploadResult.ETag,
      key: uploadResult.Key,
    });

    // Construir URLs de acesso (incluindo website endpoint)
    const publicUrl = uploadResult.Location;
    const s3Url = `s3://${process.env.S3_BUCKET_NAME}/${s3Key}`;
    const websiteUrl = `http://${process.env.S3_BUCKET_NAME}.s3-website-${
      process.env.AWS_REGION || "us-east-1"
    }.amazonaws.com/${s3Key}`;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "File uploaded successfully",
        data: {
          originalFileName: fileName,
          finalFileName: finalFileName,
          s3Key: s3Key,
          publicUrl: publicUrl,
          s3Url: s3Url,
          websiteUrl: websiteUrl,
          contentType: finalContentType,
          size: fileBuffer.length,
          uploadedAt: new Date().toISOString(),
          traceId: traceId,
          isWebsiteFile: s3Key === "index.html",
          isBase64Input: isBase64,
          quickAccess: {
            "📄 View File": publicUrl,
            "🌐 Website": websiteUrl,
            "💾 Download": publicUrl,
          },
        },
      }),
    };
  } catch (error) {
    console.error("Error uploading file:", error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: "Internal server error",
        message: "Failed to upload file to S3",
        details: error.message,
      }),
    };
  }
};

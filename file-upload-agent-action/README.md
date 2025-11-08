# File Upload Agent Action

Esta é uma função Lambda AWS que permite upload de arquivos para um bucket S3 e os serve como conteúdo estático via URL pública.

## Funcionalidades

* Upload de arquivos via API REST (POST)
* Armazenamento seguro em bucket S3
* Geração de URLs públicas para acesso aos arquivos
* Auto-detecção de Content-Type baseado na extensão do arquivo
* Suporte a CORS para uso em aplicações web
* Logging detalhado com trace IDs para debugging

## Estrutura do Projeto

```
file-upload-agent-action/
├── index.js              # Código principal da Lambda
├── package.json          # Dependências Node.js
├── openapi.yaml         # Documentação da API
└── terraform/           # Infraestrutura como código
    ├── main.tf          # Recursos AWS principais
    ├── variables.tf     # Variáveis do Terraform
    ├── provider.tf      # Configuração do provider AWS
    └── package.sh       # Script para empacotar a Lambda
```

## Como Usar

### 1. Deploy da Infraestrutura

```bash
# Navegar para a pasta terraform
cd terraform/

# Empacotar a função Lambda
./package.sh

# Inicializar o Terraform (se necessário)
terraform init

# Planejar o deploy
terraform plan

# Aplicar as mudanças
terraform apply
```

### 2. Usando a API

#### Endpoint

 `POST /file-upload-agent-action`

#### Request Body

```json
{
  "fileName": "documento.pdf",
  "fileContent": "JVBERi0xLjQKJcfsj6IKNSAwIG9iago8PAo...", // base64 encoded
  "contentType": "application/pdf" // opcional
}
```

#### Response

```json
{
  "message": "File uploaded successfully",
  "data": {
    "fileName": "documento.pdf",
    "uniqueFileName": "123e4567-e89b-12d3-a456-426614174000.pdf",
    "s3Key": "uploads/123e4567-e89b-12d3-a456-426614174000.pdf",
    "publicUrl": "https://your-bucket.s3.amazonaws.com/uploads/123e4567-e89b-12d3-a456-426614174000.pdf",
    "s3Url": "s3://your-bucket/uploads/123e4567-e89b-12d3-a456-426614174000.pdf",
    "contentType": "application/pdf",
    "size": 1048576,
    "uploadedAt": "2024-01-15T10:30:00.000Z",
    "traceId": "trace-1642248600000"
  }
}
```

### 3. Exemplo de Uso com JavaScript

```javascript
// Função para converter arquivo para base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // Remove o prefixo "data:mime/type;base64,"
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Upload do arquivo
async function uploadFile(file) {
    const base64Content = await fileToBase64(file);

    const response = await fetch('YOUR_API_GATEWAY_URL/file-upload-agent-action', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            fileName: file.name,
            fileContent: base64Content,
            contentType: file.type
        })
    });

    const result = await response.json();

    if (response.ok) {
        console.log('Arquivo enviado com sucesso!');
        console.log('URL pública:', result.data.publicUrl);
        return result.data;
    } else {
        console.error('Erro no upload:', result);
        throw new Error(result.message);
    }
}

// Uso com input de arquivo HTML
document.getElementById('fileInput').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (file) {
        try {
            const uploadResult = await uploadFile(file);
            // Usar uploadResult.publicUrl para exibir ou processar o arquivo
        } catch (error) {
            console.error('Erro:', error);
        }
    }
});
```

## Recursos AWS Criados

* **Lambda Function**: Processa os uploads de arquivo
* **S3 Bucket**: Armazena os arquivos com acesso público de leitura
* **IAM Policy**: Permissões para a Lambda acessar o S3
* **S3 Bucket Policy**: Permite acesso público de leitura aos arquivos
* **S3 CORS Configuration**: Permite requisições de diferentes domínios

## Variáveis de Ambiente

A Lambda usa as seguintes variáveis de ambiente (configuradas automaticamente pelo Terraform):

* `S3_BUCKET_NAME`: Nome do bucket S3 para upload
* `NODE_ENV`: Ambiente de execução (production)
* `STAGE`: Estágio de deployment (production)

## Segurança

* Os arquivos são armazenados com ACL `public-read` para permitir acesso via URL
* Cada arquivo recebe um nome único (UUID) para evitar conflitos
* Metadata é preservada incluindo nome original e timestamp
* Trace IDs permitem rastreamento de operações

## Limitações

* Tamanho máximo de arquivo: limitado pelo payload da API Gateway (10MB para HTTP API, 6MB para REST API)
* Para arquivos maiores, considere usar presigned URLs do S3
* Timeout da Lambda configurado para 60 segundos

## Troubleshooting

1. **Erro 400 "Missing required fields"**: Verifique se `fileName` e `fileContent` estão presentes no request
2. **Erro 400 "Invalid file content"**: Certifique-se de que `fileContent` está em base64 válido
3. **Erro 500**: Verifique os logs do CloudWatch para mais detalhes
4. **CORS Error**: A função já inclui headers CORS, mas verifique se o API Gateway está configurado corretamente

## Monitoramento

Use o `traceId` retornado na resposta para localizar logs específicos no CloudWatch. Os logs incluem:
* Informações de ambiente
* Detalhes do upload (bucket, key, content type, tamanho)
* Resultados da operação S3

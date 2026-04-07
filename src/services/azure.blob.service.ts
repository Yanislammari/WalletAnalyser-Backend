import { BlobServiceClient, BlockBlobClient, ContainerClient } from '@azure/storage-blob';
import { AZURE_BLOB_STORAGE_CONNECTION_STRING } from '../constants/env';

class AzureBlobService {
  private readonly blobServiceClient: BlobServiceClient;

  constructor() {
    this.blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_BLOB_STORAGE_CONNECTION_STRING);
  }

  public async getFile(containerName: string, fileName: string, folderName?: string): Promise<Buffer> {
    const containerClient: ContainerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobPath = folderName ? `${folderName}/${fileName}` : fileName;
    const blockBlobClient: BlockBlobClient = containerClient.getBlockBlobClient(blobPath);

    const downloadResponse = await blockBlobClient.download();
    return this.streamToBuffer(downloadResponse.readableStreamBody ?? null);
  }

  public async uploadFile(containerName: string, fileName: string, buffer: Buffer, mimeType: string, folderName?: string): Promise<string> {
    const containerClient: ContainerClient = this.blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists();

    const blobPath = folderName ? `${folderName}/${fileName}` : fileName;
    const blockBlobClient: BlockBlobClient = containerClient.getBlockBlobClient(blobPath);

    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    return blockBlobClient.url;
  }

  public async deleteFile(containerName: string, fileName: string, folderName?: string): Promise<void> {
    const containerClient: ContainerClient = this.blobServiceClient.getContainerClient(containerName);
    const blobPath = folderName ? `${folderName}/${fileName}` : fileName;
    const blockBlobClient: BlockBlobClient = containerClient.getBlockBlobClient(blobPath);

    const deleted = await blockBlobClient.deleteIfExists();
    if (!deleted.succeeded) {
      throw new Error("FAILED_TO_DELETE_FILE");
    }
  }

  private async streamToBuffer(readableStream: NodeJS.ReadableStream | null | undefined): Promise<Buffer> {
    if (!readableStream) throw new Error('Readable stream is null or undefined');

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      readableStream.on('data', (data) => chunks.push(Buffer.from(data)));
      readableStream.on('end', () => resolve(Buffer.concat(chunks)));
      readableStream.on('error', reject);
    });
  }

  public async bufferToString(buffer: Buffer, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    return buffer.toString(encoding);
  }

  public async stringToBuffer(content: string, encoding: BufferEncoding = 'utf-8'): Promise<Buffer> {
    return Buffer.from(content, encoding);
  }

  public async getFileAsString(containerName: string, fileName: string, encoding: BufferEncoding = 'utf-8', folderName?: string): Promise<string> {
    const buffer = await this.getFile(containerName, fileName, folderName);
    return this.bufferToString(buffer, encoding);
  }
}

export default AzureBlobService;

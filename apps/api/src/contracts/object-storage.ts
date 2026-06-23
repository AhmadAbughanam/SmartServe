export const OBJECT_STORAGE = "OBJECT_STORAGE";

export interface ObjectStorage {
  putObject(input: {
    bucket: string;
    key: string;
    body: Buffer | string;
    contentType?: string;
  }): Promise<void>;

  getObject(input: {
    bucket: string;
    key: string;
  }): Promise<{
    body: Buffer;
    contentType?: string;
  }>;

  deleteObject(input: {
    bucket: string;
    key: string;
  }): Promise<void>;
}

export interface ObjectStorage {
  putObject(input: {
    bucket: string;
    key: string;
    body: Buffer | string;
    contentType?: string;
  }): Promise<void>;
}


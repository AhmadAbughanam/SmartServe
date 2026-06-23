import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";
import type { ObjectStorage } from "../../contracts/object-storage.js";

@Injectable()
export class S3ObjectStorageService implements ObjectStorage, OnModuleInit {
  private readonly logger = new Logger(S3ObjectStorageService.name);
  private readonly client = new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint,
    forcePathStyle: env.s3ForcePathStyle,
    credentials: env.s3AccessKeyId && env.s3SecretAccessKey
      ? {
          accessKeyId: env.s3AccessKeyId,
          secretAccessKey: env.s3SecretAccessKey,
        }
      : undefined,
  });

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: env.s3Bucket }));
    } catch (error) {
      if (env.isDev && this.isConnectionError(error)) {
        this.logger.warn(
          `Object storage unavailable at ${env.s3Endpoint}; API will start, but managed menu image upload/read paths will fail until MinIO/S3 is reachable.`,
        );
        return;
      }
      if (!this.isMissingBucket(error)) {
        throw error;
      }
      await this.client.send(new CreateBucketCommand({ Bucket: env.s3Bucket }));
    }
  }

  async putObject(input: {
    bucket: string;
    key: string;
    body: Buffer | string;
    contentType?: string;
  }) {
    await this.client.send(new PutObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }));
  }

  async getObject(input: {
    bucket: string;
    key: string;
  }) {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    }));
    const body = await response.Body?.transformToByteArray();
    if (!body) {
      throw new NoSuchKey({
        message: `Object ${input.key} not found`,
        $metadata: response.$metadata,
      });
    }
    return {
      body: Buffer.from(body),
      contentType: response.ContentType,
    };
  }

  async deleteObject(input: {
    bucket: string;
    key: string;
  }) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: input.bucket,
      Key: input.key,
    }));
  }

  private isMissingBucket(error: unknown) {
    if (!(error instanceof S3ServiceException)) return false;
    return error.name === "NotFound" || error.name === "NoSuchBucket";
  }

  private isConnectionError(error: unknown) {
    return error instanceof Error && "code" in error && (error as { code?: string }).code === "ECONNREFUSED";
  }
}

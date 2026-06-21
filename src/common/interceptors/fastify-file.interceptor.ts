import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class FastifyFileInterceptor implements NestInterceptor {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest();

    // Check if the request is multipart
    if (!req.isMultipart()) {
      return next.handle();
    }

    try {
      // Parse the multipart request
      const parts = req.parts();
      const body: Record<string, any> = {};
      let file: any = null;

      for await (const part of parts) {
        if (part.type === 'file') {
          // A file part: store buffer and metadata
          const buffer = await part.toBuffer();
          file = {
            fieldname: part.fieldname,
            originalname: part.filename,
            encoding: part.encoding,
            mimetype: part.mimetype,
            buffer,
            size: buffer.length,
          };
        } else {
          // A text field: store in body
          body[part.fieldname] = part.value;
        }
      }

      // Assign the parsed body and file back to the request object
      // so @Body() and @UploadedFile() can access them.
      req.body = body;
      req.file = file;
    } catch (err) {
      throw new BadRequestException('Failed to process multipart request');
    }

    return next.handle();
  }
}

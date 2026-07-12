import { Request, Response } from 'express';
import * as bookService from '../services/bookService.js';

export async function list(req: Request, res: Response) {
  const result = await bookService.listBooks(req.query, req.user!.userId, req.user!.role);
  res.json(result);
}

export async function getById(req: Request, res: Response) {
  const book = await bookService.getBookById(req.params.id, req.user!.userId, req.user!.role);
  res.json({ book });
}

export async function create(req: Request, res: Response) {
  const book = await bookService.createBook(req.body, req.file, req.user!.userId);
  res.status(201).json({ book });
}

export async function updateStatus(req: Request, res: Response) {
  const result = await bookService.updateBookStatus(req.params.id, req.body.status);
  res.json({ book: result });
}

export async function bulkUpdateStatus(req: Request, res: Response) {
  const result = await bookService.bulkUpdateBookStatus(req.body.ids, req.body.status);
  res.json(result);
}

export async function uploadFile(req: Request, res: Response) {
  if (!req.file) {
    const { AppError } = await import('../middleware/errorHandler.js');
    throw new AppError(400, 'PDF file required');
  }
  const result = await bookService.uploadBookFile(req.params.id, req.file);
  res.json({ book: result });
}

export async function remove(req: Request, res: Response) {
  await bookService.deleteBook(req.params.id);
  res.status(204).send();
}

export async function assignBookshop(req: Request, res: Response) {
  const result = await bookService.assignBookToShop(req.params.id, req.body.bookshop_id);
  res.json(result);
}

export async function unassignBookshop(req: Request, res: Response) {
  const result = await bookService.unassignBookFromShop(req.params.id, req.params.bookshopId);
  res.json(result);
}

export async function listAssignedBookshops(req: Request, res: Response) {
  const shops = await bookService.listAssignedShops(req.params.id);
  res.json({ bookshops: shops });
}

export async function getStats(req: Request, res: Response) {
  const stats = await bookService.getBookStats(req.user!.userId, req.user!.role);
  res.json({ stats });
}

export async function listPageFiles(req: Request, res: Response) {
  const { AppError } = await import('../middleware/errorHandler.js');
  const book = await bookService.getBookById(req.params.id, req.user!.userId, req.user!.role);
  const files = await bookService.listBookPageFiles(book.id);
  res.json({ files });
}

export async function getFile(req: Request, res: Response) {
  const { buffer, mimeType } = await bookService.getBookFile(req.params.id);
  res.set({
    'Content-Type': mimeType,
    'Content-Disposition': 'inline; filename="secure_file"',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
  res.send(buffer);
}

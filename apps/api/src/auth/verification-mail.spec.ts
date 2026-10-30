import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerificationMailService } from './verification-mail.service.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function configure() {
  vi.stubEnv('SMTP_HOST', 'smtp.example.com');
  vi.stubEnv('SMTP_USER', 'sender@example.com');
  vi.stubEnv('SMTP_PASS', 'secret-for-test');
  vi.stubEnv('SMTP_FROM', 'BrewLite <sender@example.com>');
  vi.stubEnv('SMTP_PORT', '465');
}
describe('VerificationMailService', () => {
  it('fails clearly when SMTP is not configured', async () => {
    vi.stubEnv('SMTP_HOST', '');
    await expect(new VerificationMailService().sendCode('customer@example.com', '123456')).rejects.toThrow('chưa được cấu hình');
  });
  it('sends the code only in the email using authenticated TLS', async () => {
    configure();
    const sendMail = vi.fn().mockResolvedValue({ accepted: ['customer@example.com'], rejected: [] });
    const close = vi.fn();
    const create = vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close } as never);
    await new VerificationMailService().sendCode('customer@example.com', '123456');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ secure: true, port: 465, auth: { user: 'sender@example.com', pass: 'secret-for-test' } }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'customer@example.com', text: expect.stringContaining('123456') }));
    expect(close).toHaveBeenCalled();
  });
  it('sanitizes provider errors and never reports rejected delivery as success', async () => {
    configure();
    const sendMail = vi.fn().mockRejectedValue(new Error('sensitive provider details'));
    const close = vi.fn();
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close } as never);
    await expect(new VerificationMailService().sendCode('customer@example.com', '123456')).rejects.toThrow('Không gửi được');
    sendMail.mockResolvedValue({ accepted: [], rejected: ['customer@example.com'] });
    await expect(new VerificationMailService().sendCode('customer@example.com', '123456')).rejects.toThrow('Không gửi được');
    expect(close).toHaveBeenCalledTimes(2);
  });
});

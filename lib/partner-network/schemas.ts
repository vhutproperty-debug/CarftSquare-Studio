import { z } from 'zod';

export const partnerQuickRegistrationSchema = z.object({
  fullName: z.string().min(2).max(120),
  mobile: z.string().min(10).max(15),
  email: z.string().email().max(200),
  companyName: z.string().max(200).optional().or(z.literal('')),
  leadSource: z.string().max(200).optional().or(z.literal('')),
});

export const partnerProfileUpdateSchema = z.object({
  partnerId: z.string().min(1).optional(),
  mobile: z.string().min(10).max(15).optional(),
  operatingAreas: z.string().max(500).optional().or(z.literal('')),
  dealType: z.enum(['rental', 'sales', 'both']).optional(),
  projectsCovered: z.string().max(500).optional().or(z.literal('')),
  dealsPerMonth: z.string().max(50).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  whatsapp: z.string().max(15).optional().or(z.literal('')),
  reraNumber: z.string().max(100).optional().or(z.literal('')),
  email: z.string().email().max(200).optional().or(z.literal('')),
  agreementAccepted: z.boolean().optional(),
});

export const partnerRegistrationSchema = z.object({
  fullName: z.string().min(2).max(120),
  mobile: z.string().min(10).max(15),
  email: z.string().email().max(200),
  companyName: z.string().min(1).max(200),
  operatingAreas: z.string().min(1).max(500),
  projectsCovered: z.string().min(1).max(500),
  dealType: z.enum(['rental', 'sales', 'both']),
  dealsPerMonth: z.string().min(1).max(50),
  whatsapp: z.string().min(10).max(15),
  reraNumber: z.string().max(100).optional().or(z.literal('')),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  agreementAccepted: z.literal(true),
});

export const partnerLeadSchema = z.object({
  clientName: z.string().min(2).max(120),
  mobile: z.string().min(10).max(15),
  project: z.string().min(1).max(200),
  society: z.string().max(200).optional().or(z.literal('')),
  location: z.string().min(1).max(200),
  rentalInterior: z.boolean().default(false),
  homeInterior: z.boolean().default(false),
  budget: z.string().min(1).max(100),
  possessionDate: z.string().max(50).optional().or(z.literal('')),
  remarks: z.string().max(2000).optional().or(z.literal('')),
});

export const otpSendSchema = z.object({
  identifier: z.string().min(5).max(200).optional(),
  mobile: z.string().min(10).max(15).optional(),
  purpose: z.enum(['login', 'register']).optional(),
}).refine((data) => Boolean(data.identifier?.trim() || data.mobile?.trim()), {
  message: 'Mobile number or email is required',
});

export const otpVerifySchema = z.object({
  identifier: z.string().min(5).max(200).optional(),
  mobile: z.string().min(10).max(15).optional(),
  otp: z.string().length(6),
}).refine((data) => Boolean(data.identifier?.trim() || data.mobile?.trim()), {
  message: 'Mobile number or email is required',
});

export const partnerStatusUpdateSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']),
  notes: z.string().max(2000).optional(),
  managerId: z.string().optional(),
});

export const leadStatusUpdateSchema = z.object({
  status: z.enum([
    'registered', 'qualified', 'site_visit', 'quotation', 'negotiation',
    'won', 'execution', 'completed', 'reward_released',
  ]),
  commissionAmount: z.number().nonnegative().optional(),
  commissionType: z.enum(['fixed', 'percentage']).optional(),
  commissionStatus: z.enum(['pending', 'approved', 'paid']).optional(),
  paymentRemarks: z.string().max(2000).optional().or(z.literal('')),
  paymentDate: z.string().max(50).optional().or(z.literal('')),
  managerId: z.string().optional(),
  remarks: z.string().max(2000).optional(),
});

export const trustCountersSchema = z.record(z.string(), z.number().min(0).max(9999999));

export const managerSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  mobile: z.string().min(10).max(15),
  active: z.boolean().default(true),
});

export const paymentSchema = z.object({
  commissionId: z.string().min(1),
  amount: z.number().positive(),
  paymentReference: z.string().min(1).max(200),
  remarks: z.string().max(2000).optional(),
});

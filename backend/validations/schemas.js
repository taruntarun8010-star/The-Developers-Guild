const { z } = require('zod');

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  collegeId: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  collegeId: z.string().optional(),
  bio: z.string().optional(),
  githubUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  portfolioUrl: z.string().url().optional().or(z.literal('')),
  skills: z.array(z.string()).optional(),
  profilePhoto: z.string().optional()
});

const createEventSchema = z.object({
  name: z.string().min(2),
  date: z.preprocess((arg) => typeof arg === 'string' ? new Date(arg) : arg, z.date()),
  time: z.string(),
  description: z.string().min(10),
  category: z.string(),
  location: z.string().optional(),
  capacity: z.number().int().positive().optional(),
  registrationDeadline: z.preprocess((arg) => typeof arg === 'string' ? new Date(arg) : arg, z.date()).optional(),
});

const updateEventSchema = createEventSchema.partial();

const createProjectSchema = z.object({
  title: z.string().min(2),
  summary: z.string().min(10),
  techStack: z.array(z.string()).min(1),
  githubUrl: z.string().url().optional().or(z.literal('')),
  demoUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

const contactFormSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
});

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  updateProfileSchema,
  createEventSchema,
  updateEventSchema,
  createProjectSchema,
  contactFormSchema,
};

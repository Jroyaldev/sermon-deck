'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowRightIcon, 
  ArrowLeftIcon, 
  EnvelopeIcon, 
  LockClosedIcon, 
  UserIcon, 
  BuildingLibraryIcon, 
  CheckIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/components/providers/auth-provider';
import { motion, AnimatePresence } from 'framer-motion';

// Form validation schema
const signupSchema = z.object({
  // Step 1: Account Information
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  
  // Step 2: Personal Information
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  
  // Step 3: Church Information
  churchName: z.string().optional(),
  denomination: z.string().optional(),
  
  // Step 4: Terms and Conditions
  acceptTerms: z.boolean().refine(val => val === true, {
    message: 'You must accept the terms and conditions',
  }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type SignupFormValues = z.infer<typeof signupSchema>;

// Animation variants
const formVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: -50, transition: { duration: 0.3 } }
};

// Step 1: Account Information
function AccountInformationStep() {
  const { formState: { errors } } = useFormContext<SignupFormValues>();
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={formVariants}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-medium text-foreground">Create your account</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your email and create a strong password
        </p>
      </div>
      
      {/* Email field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email address
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <EnvelopeIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            className={`form-input pl-10 ${errors.email ? 'border-destructive focus:ring-destructive focus:border-destructive' : ''}`}
            placeholder="pastor@example.com"
          />
        </div>
        {errors.email && (
          <p className="mt-1 text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Password field */}
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LockClosedIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={`form-input pl-10 ${errors.password ? 'border-destructive focus:ring-destructive focus:border-destructive' : ''}`}
          />
        </div>
        {errors.password && (
          <p className="mt-1 text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      {/* Confirm Password field */}
      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
          Confirm Password
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LockClosedIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={`form-input pl-10 ${errors.confirmPassword ? 'border-destructive focus:ring-destructive focus:border-destructive' : ''}`}
          />
        </div>
        {errors.confirmPassword && (
          <p className="mt-1 text-sm text-destructive">{errors.confirmPassword.message}</p>
        )}
      </div>
      
      {/* Password strength indicators */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Password must contain:</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center text-xs">
            <span className={`h-4 w-4 rounded-full flex items-center justify-center mr-2 ${errors.password?.message?.includes('8 characters') ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}`}>
              <CheckIcon className="h-3 w-3" />
            </span>
            At least 8 characters
          </div>
          <div className="flex items-center text-xs">
            <span className={`h-4 w-4 rounded-full flex items-center justify-center mr-2 ${errors.password?.message?.includes('uppercase') ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}`}>
              <CheckIcon className="h-3 w-3" />
            </span>
            One uppercase letter
          </div>
          <div className="flex items-center text-xs">
            <span className={`h-4 w-4 rounded-full flex items-center justify-center mr-2 ${errors.password?.message?.includes('lowercase') ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}`}>
              <CheckIcon className="h-3 w-3" />
            </span>
            One lowercase letter
          </div>
          <div className="flex items-center text-xs">
            <span className={`h-4 w-4 rounded-full flex items-center justify-center mr-2 ${errors.password?.message?.includes('number') ? 'bg-destructive/20 text-destructive' : 'bg-success/20 text-success'}`}>
              <CheckIcon className="h-3 w-3" />
            </span>
            One number
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Step 2: Personal Information
function PersonalInformationStep() {
  const { formState: { errors } } = useFormContext<SignupFormValues>();
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={formVariants}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-medium text-foreground">Tell us about yourself</h3>
        <p className="text-sm text-muted-foreground mt-1">
          We'll personalize your experience with this information
        </p>
      </div>
      
      {/* First Name field */}
      <div>
        <label htmlFor="firstName" className="block text-sm font-medium text-foreground">
          First Name
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <UserIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            className={`form-input pl-10 ${errors.firstName ? 'border-destructive focus:ring-destructive focus:border-destructive' : ''}`}
          />
        </div>
        {errors.firstName && (
          <p className="mt-1 text-sm text-destructive">{errors.firstName.message}</p>
        )}
      </div>

      {/* Last Name field */}
      <div>
        <label htmlFor="lastName" className="block text-sm font-medium text-foreground">
          Last Name
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <UserIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            className={`form-input pl-10 ${errors.lastName ? 'border-destructive focus:ring-destructive focus:border-destructive' : ''}`}
          />
        </div>
        {errors.lastName && (
          <p className="mt-1 text-sm text-destructive">{errors.lastName.message}</p>
        )}
      </div>
    </motion.div>
  );
}

// Step 3: Church Information
function ChurchInformationStep() {
  const { formState: { errors } } = useFormContext<SignupFormValues>();
  
  // Common denominations
  const denominations = [
    "Baptist",
    "Catholic",
    "Episcopal",
    "Lutheran",
    "Methodist",
    "Non-denominational",
    "Orthodox",
    "Pentecostal",
    "Presbyterian",
    "Reformed",
    "Seventh-day Adventist",
    "Other",
    "Prefer not to say"
  ];
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={formVariants}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-medium text-foreground">Your ministry details</h3>
        <p className="text-sm text-muted-foreground mt-1">
          This information helps us tailor content to your context (optional)
        </p>
      </div>
      
      {/* Church Name field */}
      <div>
        <label htmlFor="churchName" className="block text-sm font-medium text-foreground">
          Church or Ministry Name
        </label>
        <div className="mt-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <BuildingLibraryIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <input
            id="churchName"
            name="churchName"
            type="text"
            className="form-input pl-10"
            placeholder="Grace Community Church"
          />
        </div>
      </div>

      {/* Denomination field */}
      <div>
        <label htmlFor="denomination" className="block text-sm font-medium text-foreground">
          Denomination or Tradition
        </label>
        <div className="mt-1">
          <select
            id="denomination"
            name="denomination"
            className="form-select"
            defaultValue=""
          >
            <option value="" disabled>Select a denomination</option>
            {denominations.map((denom) => (
              <option key={denom} value={denom}>{denom}</option>
            ))}
          </select>
        </div>
      </div>
    </motion.div>
  );
}

// Step 4: Terms and Conditions
function TermsAndConditionsStep() {
  const { formState: { errors } } = useFormContext<SignupFormValues>();
  
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={formVariants}
      className="space-y-6"
    >
      <div>
        <h3 className="text-lg font-medium text-foreground">Almost there!</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Please review and accept our terms to complete your registration
        </p>
      </div>
      
      {/* Terms and Conditions */}
      <div className="p-4 bg-secondary/30 rounded-md border border-border max-h-48 overflow-y-auto">
        <h4 className="text-sm font-medium mb-2">Terms of Service</h4>
        <p className="text-xs text-muted-foreground mb-2">
          By using SermonFlow, you agree to these terms, which allow you to use our services as long as you follow these terms and any applicable laws.
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          We provide our services using reasonable skill and care. If we don't meet the quality level described in this agreement, you agree to tell us and we'll work with you to try to resolve the issue.
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          We may change these terms or any additional terms that apply to our services to reflect changes to the law or changes to our services. We'll post notice of modifications to these terms on this page.
        </p>
        <h4 className="text-sm font-medium mt-4 mb-2">Privacy Policy</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Our privacy policies explain how we treat your personal data and protect your privacy when you use our services. By using our services, you agree that SermonFlow can use such data in accordance with our privacy policies.
        </p>
      </div>
      
      {/* Accept Terms Checkbox */}
      <div className="flex items-start">
        <div className="flex items-center h-5">
          <input
            id="acceptTerms"
            name="acceptTerms"
            type="checkbox"
            className={`form-checkbox ${errors.acceptTerms ? 'border-destructive text-destructive' : ''}`}
          />
        </div>
        <div className="ml-3 text-sm">
          <label htmlFor="acceptTerms" className="font-medium text-foreground">
            I accept the <Link href="/terms" className="text-primary hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </label>
          {errors.acceptTerms && (
            <p className="mt-1 text-sm text-destructive">{errors.acceptTerms.message}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// Main signup component
export default function SignupPage() {
  const { register, isLoading, error, clearError, isAuthenticated } = useAuth();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;
  
  // Form methods
  const methods = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      churchName: '',
      denomination: '',
      acceptTerms: false,
    },
  });
  
  const { 
    handleSubmit, 
    trigger, 
    formState: { errors, isSubmitting, isValid },
    watch,
    register: registerField,
    setValue,
  } = methods;
  
  // Register all fields
  useEffect(() => {
    registerField('email');
    registerField('password');
    registerField('confirmPassword');
    registerField('firstName');
    registerField('lastName');
    registerField('churchName');
    registerField('denomination');
    registerField('acceptTerms');
  }, [registerField]);
  
  // Watch all fields for validation
  const watchAllFields = watch();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);
  
  // Handle next step
  const handleNextStep = async () => {
    let fieldsToValidate: (keyof SignupFormValues)[] = [];
    
    // Determine which fields to validate based on current step
    switch (currentStep) {
      case 1:
        fieldsToValidate = ['email', 'password', 'confirmPassword'];
        break;
      case 2:
        fieldsToValidate = ['firstName', 'lastName'];
        break;
      case 3:
        // Church information is optional, no validation needed
        setCurrentStep(currentStep + 1);
        return;
      default:
        break;
    }
    
    // Validate the fields for the current step
    const isStepValid = await trigger(fieldsToValidate);
    
    if (isStepValid) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  // Handle previous step
  const handlePrevStep = () => {
    setCurrentStep(currentStep - 1);
  };
  
  // Handle form submission
  const onSubmit = async (data: SignupFormValues) => {
    try {
      // Register the user
      await register({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        churchName: data.churchName || undefined,
        denomination: data.denomination || undefined,
      });
      
      // Redirect will happen automatically in the useEffect above
    } catch (err) {
      // Error is handled by the auth provider
      console.error('Registration error:', err);
    }
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <AccountInformationStep />;
      case 2:
        return <PersonalInformationStep />;
      case 3:
        return <ChurchInformationStep />;
      case 4:
        return <TermsAndConditionsStep />;
      default:
        return null;
    }
  };
  
  // Calculate progress percentage
  const progressPercentage = ((currentStep - 1) / (totalSteps - 1)) * 100;
  
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-secondary/20">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center space-x-2">
            <Image 
              src="/logo.svg" 
              alt="SermonFlow Logo" 
              width={48} 
              height={48}
              className="w-12 h-12"
            />
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              SermonFlow
            </span>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Join thousands of pastors using SermonFlow
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 border border-border">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Step {currentStep} of {totalSteps}</span>
              <span>{Math.round(progressPercentage)}% Complete</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          
          {/* Error alert */}
          {error && (
            <div className="mb-6 bg-destructive/10 border border-destructive/30 text-destructive p-3 rounded-md flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{error}</p>
              </div>
              <div className="ml-auto">
                <button
                  type="button"
                  className="inline-flex text-destructive focus:outline-none"
                  onClick={clearError}
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          {/* Multi-step form */}
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <AnimatePresence mode="wait">
                {renderStepContent()}
              </AnimatePresence>
              
              {/* Form navigation buttons */}
              <div className="mt-8 flex justify-between">
                {currentStep > 1 ? (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="btn btn-outline flex items-center"
                  >
                    <ArrowLeftIcon className="mr-2 h-4 w-4" />
                    Back
                  </button>
                ) : (
                  <div></div> // Empty div to maintain flex spacing
                )}
                
                {currentStep < totalSteps ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="btn btn-primary flex items-center"
                  >
                    Next
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isLoading || isSubmitting || !isValid}
                    className="btn btn-primary flex items-center"
                  >
                    {isLoading || isSubmitting ? (
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <>
                        Create Account
                        <ArrowRightIcon className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </FormProvider>

          {/* Social signup buttons */}
          {currentStep === 1 && (
            <>
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-card text-muted-foreground">Or sign up with</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="btn btn-outline w-full flex items-center justify-center"
                  >
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z" fill="#EA4335"/>
                      <path d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.08L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z" fill="#4285F4"/>
                      <path d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z" fill="#FBBC05"/>
                      <path d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.075C15.0054 18.785 13.6204 19.255 12.0004 19.255C8.8704 19.255 6.21537 17.145 5.2654 14.295L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z" fill="#34A853"/>
                    </svg>
                    Google
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline w-full flex items-center justify-center"
                  >
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.933.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10c0-5.523-4.477-10-10-10z" clipRule="evenodd" />
                    </svg>
                    GitHub
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Login link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/auth/login" className="font-medium text-primary hover:text-primary/80">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

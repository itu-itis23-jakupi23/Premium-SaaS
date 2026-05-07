import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "wouter";
import { useState } from "react";
import { AuthLayout } from "@/components/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ArrowLeft } from "lucide-react";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  function onSubmit(values: ForgotPasswordFormValues) {
    console.log("Forgot password values:", values);
    setIsSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <AuthLayout title="Check your email">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-2">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <p className="text-muted-foreground">
            We've sent a password reset link to <span className="text-foreground font-medium">{form.getValues("email")}</span>. 
            Please check your inbox and follow the instructions.
          </p>
          <Button variant="outline" className="w-full mt-4" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Reset password" 
      description="Enter your email and we'll send you a link to reset your password"
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="name@company.com" {...field} data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" data-testid="button-reset">
            Send Reset Link
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center">
        <Link href="/login">
          <a className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </a>
        </Link>
      </div>
    </AuthLayout>
  );
}

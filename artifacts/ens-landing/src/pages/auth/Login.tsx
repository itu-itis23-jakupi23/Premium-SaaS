import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useLocation } from "wouter";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Shield, User, Briefcase } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean().default(false),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  function onSubmit(values: LoginFormValues) {
    console.log("Login values:", values);
    // In a real app, we would authenticate here
    setLocation("/chief");
  }

  const quickLogin = (role: "chief" | "pm" | "client") => {
    setLocation(`/${role === "chief" ? "chief" : role === "pm" ? "pm" : "client"}`);
  };

  return (
    <AuthLayout 
      title="Welcome back" 
      description="Enter your credentials to access your workspace"
    >
      <div className="relative mb-8 overflow-hidden rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
        <div className="absolute -right-4 -top-4 h-24 w-24 rotate-12 border border-primary/10 opacity-20" style={{ transformStyle: 'preserve-3d' }}>
           <div className="h-full w-full border border-primary/40" style={{ transform: 'translateZ(20px)' }} />
        </div>
        <p className="text-xs font-medium uppercase tracking-wider text-primary">Secure Access Terminal</p>
      </div>

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
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between">
            <FormField
              control={form.control}
              name="rememberMe"
              render={({ field }) => (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-remember"
                  />
                  <label
                    htmlFor="rememberMe"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Remember me
                  </label>
                </div>
              )}
            />
            <Link href="/forgot-password">
              <a className="text-sm font-medium text-primary hover:underline">
                Forgot password?
              </a>
            </Link>
          </div>

          <Button type="submit" className="w-full" data-testid="button-login">
            Sign In
          </Button>
        </form>
      </Form>

      <div className="relative my-8">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Quick access portals</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Button 
          variant="outline" 
          className="justify-start gap-3 border-primary/20 hover:bg-primary/5"
          onClick={() => quickLogin("chief")}
          data-testid="button-login-chief"
        >
          <Shield className="h-4 w-4 text-primary" />
          Login as Chief Manager
        </Button>
        <Button 
          variant="outline" 
          className="justify-start gap-3 border-accent/20 hover:bg-accent/5"
          onClick={() => quickLogin("pm")}
          data-testid="button-login-pm"
        >
          <Briefcase className="h-4 w-4 text-accent" />
          Login as Project Manager
        </Button>
        <Button 
          variant="outline" 
          className="justify-start gap-3 border-muted-foreground/20 hover:bg-muted-foreground/5"
          onClick={() => quickLogin("client")}
          data-testid="button-login-client"
        >
          <User className="h-4 w-4 text-muted-foreground" />
          Login as Client
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link href="/signup">
          <a className="font-medium text-primary hover:underline" data-testid="link-signup">
            Sign up
          </a>
        </Link>
      </p>
    </AuthLayout>
  );
}

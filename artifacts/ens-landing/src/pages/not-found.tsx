import { motion } from 'framer-motion';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-[0.06]" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 text-center px-6 max-w-lg mx-auto"
      >
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl font-mono shadow-[0_0_20px_rgba(109,40,217,0.5)]">
            E
          </div>
          <span className="font-bold text-xl tracking-tight">ENS Platform</span>
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-[140px] font-black leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground/80 to-foreground/10 select-none mb-4"
        >
          404
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-5 border border-primary/20">
            <Search className="w-3 h-3" />
            Page not found
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-3 tracking-tight">
            This booth doesn't exist
          </h1>
          <p className="text-muted-foreground mb-10 leading-relaxed">
            The page you're looking for has either moved, been removed, or never existed.
            Let's get you back to the platform.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto rounded-full px-7 h-11 font-semibold gap-2 shadow-[0_0_20px_rgba(109,40,217,0.3)]"
            >
              <Home className="w-4 h-4" /> Back to Home
            </Button>
            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full sm:w-auto rounded-full px-7 h-11 font-semibold gap-2 border-border/60"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Button>
          </div>

          <div className="mt-12 pt-8 border-t border-border/40 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
            {[
              { label: 'Home', path: '/' },
              { label: 'Staff Portal', path: '/team' },
              { label: 'Log In', path: '/login' },
              { label: 'Sign Up', path: '/signup' },
            ].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)} className="hover:text-primary transition-colors">
                {label}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

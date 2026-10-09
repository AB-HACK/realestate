import { Link } from "react-router-dom";
import { Building, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-6 text-center">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Building className="h-6 w-6" />
        </div>
        <span className="font-display text-xl font-bold">AecrenEstates</span>
      </div>
      <h1 className="mt-8 font-display text-6xl font-bold text-muted-foreground">404</h1>
      <p className="mt-2 font-display text-xl font-semibold">Page not found</p>
      <p className="mt-1 text-sm text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/dashboard" className="mt-6">
        <Button><ArrowLeft className="h-4 w-4" /> Back to Dashboard</Button>
      </Link>
    </div>
  );
}

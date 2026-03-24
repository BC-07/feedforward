"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, LogOut, User, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isAdminRoute = pathname.startsWith("/admin");

  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [adminName, setAdminName] = useState("");

  useEffect(() => {
    const userLoggedIn = localStorage.getItem("isUserLoggedIn") === "true";
    const adminLoggedIn = localStorage.getItem("isAdminLoggedIn") === "true";

    setIsUserLoggedIn(userLoggedIn);
    setIsAdminLoggedIn(adminLoggedIn);

    if (userLoggedIn) {
      setUserName(localStorage.getItem("currentUserName") || "");
    }

    if (adminLoggedIn) {
      setAdminName(localStorage.getItem("currentAdminName") || "");
    }
  }, [pathname]);

  const handleUserLogout = () => {
    localStorage.removeItem("isUserLoggedIn");
    localStorage.removeItem("currentUserId");
    localStorage.removeItem("currentUserName");

    setIsUserLoggedIn(false);
    setUserName("");

    toast.success("Logged out successfully");
    router.push("/");
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("currentAdminId");
    localStorage.removeItem("currentAdminName");

    setIsAdminLoggedIn(false);
    setAdminName("");

    toast.success("Admin logged out successfully");
    router.push("/");
  };

  return (
    <html lang="en">
      <body className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b border-border bg-white">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <ArrowRight className="h-8 w-8 text-accent" />
                <div>
                  <h1 className="text-xl font-bold text-primary tracking-tight">
                    FEED FORWARD
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    SMART. FAST. SAFE.
                  </p>
                </div>
              </Link>

              {!isAdminRoute && (
                <nav className="flex items-center gap-6">
                  <Link
                    href="/track"
                    className={`items-center gap-2 text-sm hover:text-accent transition-colors ${isUserLoggedIn ? "flex" : "hidden sm:flex"}`}
                    aria-label="Track Submission"
                  >
                    <Eye className="h-4 w-4 sm:hidden" />
                    <span className="hidden sm:inline">Track Submission</span>
                  </Link>

                  {isUserLoggedIn ? (
                    <div className="flex items-center gap-3">
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 text-sm hover:text-accent transition-colors"
                      >
                        <User className="h-4 w-4" />
                        <span className="font-medium">{userName}</span>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleUserLogout}
                        className="text-sm"
                        aria-label="Logout"
                      >
                        <LogOut className="h-4 w-4 sm:mr-1" />
                        <span className="hidden sm:inline">Logout</span>
                      </Button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="hidden items-center justify-center gap-2 text-sm bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent/90 transition-colors sm:flex"
                      aria-label="Log In"
                    >
                      <User className="h-4 w-4 sm:hidden" />
                      <span className="hidden sm:inline">Log In</span>
                    </Link>
                  )}
                </nav>
              )}

              {isAdminRoute && isAdminLoggedIn && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary" />
                    <span className="font-medium">{adminName}</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAdminLogout}
                    aria-label="Logout"
                  >
                    <LogOut className="h-4 w-4 sm:mr-1" />
                    <span className="hidden sm:inline">Logout</span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer className="border-t border-border bg-white mt-auto">
          <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
            <p>
              &copy; {new Date().getFullYear()} FeedForward. All rights
              reserved.
            </p>
            <p className="mt-1">
              Making feedback management smart, fast, and safe.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

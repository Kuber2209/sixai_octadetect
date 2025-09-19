"use client";

import { useEffect, useState } from "react";
import { Stethoscope } from "lucide-react";
import Link from "next/link";

export function Footer() {
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="border-t bg-card">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0 px-4 md:px-6">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <Link href="#home" className="flex items-center gap-2 text-primary">
            <Stethoscope className="h-6 w-6" />
            <span className="font-bold">VisionaryCheck</span>
          </Link>
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            &copy; {currentYear}. All rights reserved.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          <a
            href="mailto:aumbawiskar@gmail.com"
            className="transition-colors hover:text-foreground"
          >
            aumbawiskar@gmail.com
          </a>
        </div>
      </div>
    </footer>
  );
}

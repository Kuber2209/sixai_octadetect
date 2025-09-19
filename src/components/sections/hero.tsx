import Image from "next/image";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const heroImage = PlaceHolderImages.find(
    (img) => img.id === "hero-medical-ai"
  );
  return (
    <section id="home" className="w-full py-16 md:py-24 lg:py-32 bg-secondary/30">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold font-headline tracking-tighter sm:text-5xl xl:text-6xl/none">
                Early Detection, Better Outcomes
              </h1>
              <p className="max-w-[600px] text-muted-foreground md:text-xl">
                Our AI-powered tool analyzes medical images and clinical data
                for early detection of Oral and Cervical cancers, paving the way
                for timely intervention and improved patient prognosis.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button asChild size="lg">
                <Link href="#analyze">
                  Start Analysis <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
          {heroImage && (
            <div className="relative mx-auto w-full max-w-[600px] h-auto aspect-video">
                <Image
                    src={heroImage.imageUrl}
                    alt={heroImage.description}
                    fill
                    className="rounded-xl object-cover shadow-2xl"
                    data-ai-hint={heroImage.imageHint}
                />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

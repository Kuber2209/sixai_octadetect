import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Hero } from '@/components/sections/hero';
import { About } from '@/components/sections/about';
import { Contact } from '@/components/sections/contact';
import { AnalysisForm } from '@/components/analysis-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Home() {
  return (
    <div className="flex flex-col min-h-dvh bg-background">
      <Header />
      <main className="flex-1">
        <Hero />
        <section id="analyze" className="py-16 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <Card className="max-w-4xl mx-auto shadow-lg">
              <CardHeader className="text-center">
                <CardTitle className="text-3xl font-headline tracking-tight sm:text-4xl">
                  Analyze Medical Image
                </CardTitle>
                <CardDescription className="text-md">
                  Upload a medical image to get an AI-powered risk assessment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AnalysisForm />
              </CardContent>
            </Card>
          </div>
        </section>
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  );
}

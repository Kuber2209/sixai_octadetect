"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload } from "lucide-react";

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
import { ResultsDisplay, type DemoResult } from "./results-display";
import Image from "next/image";
import { DEMO_RESULTS } from "@/lib/demo-data";

const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const formSchema = z.object({
  image: z
    .instanceof(File, { message: "An image is required." })
    .refine(
      (file) => file.size <= MAX_FILE_SIZE,
      `Max file size is 5MB.`
    )
    .refine(
      (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
      "Only .jpeg, .png, and .webp files are accepted."
    ),
});

export function AnalysisForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      image: undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResult(null);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    // Select a random result from the demo data
    const randomResult = DEMO_RESULTS[Math.floor(Math.random() * DEMO_RESULTS.length)];
    setResult(randomResult);

    setIsLoading(false);
  }
  
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue('image', file, { shouldValidate: true });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      form.setValue('image', undefined, { shouldValidate: true });
      setImagePreview(null);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Medical Image</FormLabel>
                <FormControl>
                   <label className="relative flex justify-center items-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Input
                        type="file"
                        className="absolute w-full h-full opacity-0 cursor-pointer"
                        accept={ACCEPTED_IMAGE_TYPES.join(",")}
                        onChange={handleImageChange}
                      />
                      {imagePreview ? (
                        <Image src={imagePreview} alt="Image preview" fill style={{objectFit: 'contain'}} className="rounded-lg p-2" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                          <Upload className="w-10 h-10 mb-2" />
                          <p className="text-sm font-semibold">Click to upload or drag & drop</p>
                          <p className="text-xs">JPEG, PNG, WEBP (MAX. 5MB)</p>
                        </div>
                      )}
                    </label>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" size="lg" className="w-full" disabled={isLoading || !form.formState.isValid}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Run Demo Analysis
          </Button>
        </form>
      </Form>
      {result && <ResultsDisplay result={result} />}
    </>
  );
}

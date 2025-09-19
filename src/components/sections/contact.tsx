export function Contact() {
  return (
    <section id="contact" className="w-full py-16 md:py-24 lg:py-32">
      <div className="container px-4 md:px-6">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <h2 className="text-3xl font-bold font-headline tracking-tighter sm:text-4xl">
            Contact Us
          </h2>
          <p className="text-muted-foreground md:text-xl/relaxed">
            Have questions, feedback, or want to collaborate? We'd love to
            hear from you.
          </p>
          <p className="text-lg font-medium pt-4">
            Email:{" "}
            <a
              href="mailto:contact@visionarycheck.com"
              className="text-accent underline-offset-4 hover:underline"
            >
              contact@visionarycheck.com
            </a>
          </p>
        </div>
      </div>
    </section>
  );
}

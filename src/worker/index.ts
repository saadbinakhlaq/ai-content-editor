async function main(): Promise<void> {
  console.log("Worker started");
  // later:
  // - connect BullMQ
  // - process text jobs
  // - process voice jobs
  // - process image jobs
}

main().catch((error) => {
  console.error("Worker failed", error);
  process.exit(1);
});
"use client";
import { motion } from "framer-motion";
import { Icons } from "./icons"; // Assuming Icons.Bot is defined

export function ProcessingIndicator() {
  return (
    <div className="flex flex-col items-center justify-center p-4 space-y-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      >
        <Icons.Bot className="h-10 w-10 text-primary" />
      </motion.div>
      <p className="text-sm text-muted-foreground">
        AI is thinking...
      </p>
    </div>
  );
}

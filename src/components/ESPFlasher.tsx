// components/ProgramFlasher.tsx
"use client";
import programs from "@/data/programs.json";
import { useEffect, useState } from "react";

type ProgramPart = {
  address: string;
  path: string;
};

type Program = {
  name: string;
  parts: ProgramPart[];
};

type ESPToolImports = {
  ESPLoader?: any;
  Transport?: any;
};

export default function ProgramFlasher() {
  const [status, setStatus] = useState("");
  const [esp, setEsp] = useState<ESPToolImports>({});
  const [currentProgram, setCurrentProgram] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    const loadEsptool = async () => {
      try {
        const esptool = await import("esptool-js");
        setEsp({
          ESPLoader: esptool.ESPLoader,
          Transport: esptool.Transport,
        });
      } catch (err) {
        console.error("Failed to load esptool:", err);
      }
    };
    loadEsptool();
  }, []);

  const loadBinaryFile = async (path: string): Promise<string> => {
    try {
      const response = await fetch(path);
      const buffer = await response.arrayBuffer();
      const uint8View = new Uint8Array(buffer);

      // Process the binary data in chunks to avoid call stack overflow
      const chunkSize = 0x8000; // Process 32KB at a time
      let result = "";

      for (let i = 0; i < uint8View.length; i += chunkSize) {
        const chunk = uint8View.slice(i, i + chunkSize);
        result += String.fromCharCode.apply(null, Array.from(chunk));
      }

      return result;
    } catch (err) {
      throw new Error(`Failed to load binary file ${path}: ${err.message}`);
    }
  };

  const flash = async (program: Program) => {
    if (!esp.ESPLoader || !esp.Transport) {
      return setStatus("ESPTool not loaded");
    }

    try {
      setIsFlashing(true);
      setCurrentProgram(program.name);
      setStatus("Connecting to device...");

      const device = await navigator.serial.requestPort({});
      const transport = new esp.Transport(device, true);

      const loader = new esp.ESPLoader({
        transport,
        baudrate: 460800,
        terminal: {
          clean: () => {},
          writeLine: (msg: string) => setStatus(msg),
          write: (msg: string) => setStatus(msg),
        },
      });

      await loader.main();
      setStatus("Connected. Erasing flash...");
      await loader.eraseFlash();

      // Load all binary files for the program
      setStatus("Loading binary files...");
      const fileArray = await Promise.all(
        program.parts.map(async (part) => ({
          data: await loadBinaryFile(part.path),
          address: parseInt(part.address),
        }))
      );

      setStatus("Flashing program...");
      await loader.writeFlash({
        fileArray,
        flashSize: "keep",
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          const percent = Math.round((written / total) * 100);
          const currentFile = program.parts[fileIndex].path.split("/").pop();
          setStatus(`Flashing ${currentFile} (${percent}%)`);
        },
      });

      setStatus("Success! Disconnecting...");
      await transport.disconnect();
      setStatus("Done!");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsFlashing(false);
      setCurrentProgram(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">ESP32 Program Flasher</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {(programs as Program[]).map((program) => (
          <button
            key={program.name}
            onClick={() => flash(program)}
            disabled={isFlashing}
            className={`p-4 rounded shadow transition 
              ${
                currentProgram === program.name
                  ? "bg-blue-600 text-white"
                  : "bg-white hover:bg-blue-50"
              } 
              ${isFlashing ? "opacity-50 cursor-not-allowed" : ""}
            `}
          >
            <div className="text-lg">{program.name}</div>
            <div className="text-sm opacity-75">
              {program.parts.length} parts
            </div>
          </button>
        ))}
      </div>

      {status && (
        <div
          className={`p-4 rounded ${
            status.includes("Error")
              ? "bg-red-100 text-red-700"
              : status.includes("Success") || status === "Done!"
              ? "bg-green-100 text-green-700"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {status}
        </div>
      )}
    </div>
  );
}

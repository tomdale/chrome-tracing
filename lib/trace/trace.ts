import Process from "./process";
import Thread from "./thread";
import Bounds from "./bounds";

import {
  TraceEvent,
  TRACE_EVENT_PHASE_METADATA
} from "./trace_event";

export default class Trace {
  processMap: { [pid: number]: Process; } = {};
  processes: Process[] = [];
  mainProcess: Process;
  bounds: Bounds = new Bounds();
  events: TraceEvent[] = [];
  browserProcess: Process = null;
  gpuProcess: Process = null;
  rendererProcesses: Process[] = [];

  numberOfProcessors: number;

  process(pid: number): Process {
    let process = this.processMap[pid];
    if (process === undefined) {
      this.processMap[pid] = process = new Process(pid);
      this.processes.push(process);
    }
    return process;
  }

  thread(pid: number, tid: number): Thread {
    return this.process(pid).thread(tid);
  }

  addEvents(events: TraceEvent[]) {
    for (let i = 0; i < events.length; i++) {
      this.addEvent(events[i]);
    }
  }

  addEvent(event: TraceEvent) {
    this.events.push(event);
    if (event.ph === TRACE_EVENT_PHASE_METADATA) {
      this.addMetadata(event);
      return;
    }
    this.bounds.addEvent(event);
    this.process(event.pid).addEvent(event);
  }

  addMetadata(event: TraceEvent) {
    let pid = event.pid;
    let tid = event.tid;
    switch (event.name) {
      case "num_cpus":
        this.numberOfProcessors = event.args["number"];
        break;
      case "process_name":
        let process_name: string = event.args["name"];
        let process = this.process(pid);
        process.name = process_name;
        if (process_name === "GPU Process") {
          this.gpuProcess = process;
        } else if (process_name === "Browser") {
          this.browserProcess = process;
        } else if (process_name === "Renderer") {
          this.rendererProcesses.push(process);
        }
        break;
      case "process_labels":
        this.process(pid).labels = event.args["labels"];
        break;
      case "process_sort_index":
        this.process(pid).sortIndex = event.args["sort_index"];
        break;
      case "trace_buffer_overflowed":
        this.process(pid).traceBufferOverflowedAt = event.args["overflowed_at_ts"];
        break;
      case "thread_name":
        let thread_name: string = event.args["name"];
        let thread = this.thread(pid, tid);
        thread.name = thread_name;
        if (thread_name === 'CrRendererMain') {
          this.process(pid).mainThread = thread;
        } else if (thread_name === 'ScriptStreamerThread') {
          this.process(pid).scriptStreamerThread = thread;
        }
        break;
      case "thread_sort_index":
        this.thread(pid, tid).sortIndex = event.args["sort_index"];
        break;
      case "IsTimeTicksHighResolution":
        this.process(pid).isTimeTicksHighResolution = event.args["value"];
        break;
      case "TraceConfig":
        this.process(pid).traceConfig = event.args["value"];
        break;
      default:
        console.warn("unrecognized metadata:", JSON.stringify(event, null, 2));
        break;
    }
  }
}

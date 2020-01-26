#!/usr/bin/env node
import { CommandHello } from "./command-hello";
import * as commandLineArgs from 'command-line-args';
import * as commandLineUsage from 'command-line-usage';
import { CommandVersion } from "./command-version";

type CommandType = "hello" | "version";

type MainConfig = {
  command: CommandType,
};

class Main {
  private readonly mainUsage = [
    {
      header: 'Command Line Interface for My great service',
      content: 'Sample for CLI.',
    },
    {
      header: 'Commands',
      content: {
        data: [
          { colA: 'my-great hello -f <first_name> -s <second_name>', colB: 'Say Hello.'},
          { colA: 'my-great version', colB: 'Show version.'},
        ],
        options: { maxWidth: 100 }
      }    
    }
  ];

  private readonly paramDef = [
    {
      name: 'command', 
      type: String,
      require: true,
      defaultOption: true,
    }
  ];

  private commandMap =  new Map<CommandType, ()=>Promise<number>>([
    // [ "hello", () => new CommandHello().exec() ],
    [ "version", () => new CommandVersion().exec() ],
  ]);
  
  async run() {
    const cfg = commandLineArgs(this.paramDef, { partial: true }) as MainConfig;

    const exec = this.commandMap.get(cfg.command);
    if (exec != null) {
      const ret = await exec();
      process.exit(ret);
    } else {
      const usg = commandLineUsage(this.mainUsage);
      console.log(usg);  
      process.exit(1);
    }
  }
};

new Main().run().then(x => {
  
});

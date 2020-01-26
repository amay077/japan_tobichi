import * as commandLineArgs from 'command-line-args';
import * as commandLineUsage from 'command-line-usage';

type HelloConfig = {
  first_name: string,
  second_name: string,
  age?: number;
};

export class CommandHello {
  
  private readonly usage = [
    {
      header: 'Say Hello Command',
      content: 'my-great hello -f <first_name> -s <second_name>',
    },
    {
      header: 'Parameters',
      hide: [ 'command' ],
      optionList: []
    }
  ];

  private readonly paramDef = [
    {
      name: 'command', 
      type: String,
      require: true,
      defaultOption: true,
    },
    {
      name: 'first_name', 
      alias: 'f', 
      description: 'Your first name.',
      type: String,
      require: true,
    },
    {
      name: 'second_name', 
      alias: 's', 
      description: 'Your second name.',
      type: String,
      require: true,
    },
    {
      name: 'age', 
      alias: 'a', 
      description: '(Option)Your age.',
      type: Number,
      require: false,
    },
  ];
  
  exec(): number {
    const cfg = commandLineArgs(this.paramDef) as HelloConfig;

    // Valid require params
    const requiresNotSetted = this.paramDef
      .filter(x => x.require)
      .filter(x => cfg[x.name] == null)
      .map(x => `--${x.name}`);

    if (requiresNotSetted.length > 0) {
      console.log(`Param: ${requiresNotSetted.join(' ')} is required.`);
      console.log(`------------------------------------`);
      this.usage[1].optionList = this.paramDef;
      const usg = commandLineUsage(this.usage)
      console.log(usg);  
      return -1;
    }

    return this.run(cfg);
  }

  private run(cfg: HelloConfig): number {
    console.log(`Hello ${cfg.first_name} ${cfg.second_name}.`);
    if (cfg.age) {
      console.log(`You're ${cfg.age} years old.`);
    }

    return 0;
  }
}

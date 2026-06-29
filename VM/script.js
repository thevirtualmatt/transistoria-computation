const byte = document.getElementById("byte");
const byteCtx = byte.getContext("2d");

const bitSize = 20;

byte.width = 4 * bitSize;
byte.height = 1 * bitSize;
byteCtx.fillStyle = "black";
byteCtx.fillRect(0, 0, byte.width, byte.height);

class CPU {
  constructor() {
    this.registerNames = {
        0: 'in',
        1: 'A',
        2: 'B',
        3: 'C',
        4: 'D',
        5: 'E',
        6: 'F',
        7: 'out',
    }
    this.registers = new Array(8);
    this.registerTexts = Array.from(document.getElementById("regs").children);
    this.instructionMemory = new Array(16);
    this.pc = 0;
    this.pcText = document.getElementById("pc");
    this.flags = new Array(2).fill(false);
    this.isRunning;
    this.clockSpeed;
    this.clockSlider = document.getElementById("speed");
    this.deltaTime = 0;
    this.instructions;
    this.executions;
    this.leds = new LED(this, byteCtx);
    this.cpuJumped;
    this.isHalting = false;
    this.cpuJumped = false;

    this.lastTime = performance.now();
  }

  start(programLines) {
    this.instructions = programLines;
    for (let i = 0; i < this.instructions.length; i++) this.instructionMemory[i] = this.instructions[i];

    this.executions = {
      '0': (op) => {  },
      '1': (op) => this.toggle(),
      '2': (op) => this.loadRegister((op & 8) > 0 ? 1 : op, this.readRegister((op & 8) > 0 ? op - 8 : 1)),
      '3': (op) => {
        const oldValue = this.readRegister(op);
        const result = this.readRegister(1) + this.readRegister(2);
        this.loadRegister(op, result);
        this.flags[0] = result == 0;
        this.flags[1] = result < oldValue;
      },
      '4': (op) => {
        const valueA = this.readRegister(1);
        const valueB = this.readRegister(2);
        const result = this.readRegister(1) - this.readRegister(2);
        this.loadRegister(op, result);
        this.flags[0] = result == 0;
        this.flags[1] = ((valueA + (~valueB & 0x0F) + 1) & 0x10) > 0;
      },
      '5': (op) => {
        const valueA = this.readRegister(1);
        const valueB = this.readRegister(2);
        const result = this.readRegister(1) & this.readRegister(2);
        this.loadRegister(op, result);
        this.flags[0] = result == 0;
        this.flags[1] = (((~valueA) + (~valueB)) & 0x10) > 0;
      },
      '6': (op) => {
        const valueA = this.readRegister(1);
        const valueB = this.readRegister(2);
        const result = ~(this.readRegister(1) | this.readRegister(2));
        this.loadRegister(op, result);
        this.flags[0] = result == 0;
        this.flags[1] = ((valueA + valueB) & 0x10) > 0;
      },
      '7': (op) => {
        const valueA = this.readRegister(1);
        const valueB = this.readRegister(2);
        const result = this.readRegister(1) ^ this.readRegister(2);
        this.loadRegister(op, result);
        this.flags[0] = result == 0;
        this.flags[1] = ((valueA & 0x08) > 0) || (((~valueB) & 0x08) > 0);
      },
      '8': (op) => {
        const valueA = this.readRegister(1);
        const valueB = this.readRegister(2);
        const result = this.readRegister(1) >>> 1;
        this.loadRegister(op, result);
        this.flags[0] = result == 0;
        this.flags[1] = ((valueA + valueB) & 0x10) > 0;
      },
      '9': (op) => this.loadRegister(1, op),
      'A': (op) => {
        const oldValue = this.readRegister(1);
        const result = this.readRegister(1) + op;
        this.loadRegister(1, result);
        this.flags[0] = result == 0;
        this.flags[1] = result < oldValue;
    },
      'B': (op) => this.writePc(op),
      'C': (op) => { if (this.flags[0]) this.writePc(op); },
      'D': (op) => { if (this.flags[1]) this.writePc(op); },
      'E': (op) => { if (!this.flags[0]) this.writePc(op); },
      'F': (op) => { if (!this.flags[1]) this.writePc(op); },
    };
  }

  update(now) {
    this.clockSpeed = this.clockSlider.value;
    this.deltaTime += this.clockSpeed * ((now - this.lastTime) / 1000)
    this.lastTime = now;

    for (let i = 0; Math.floor(this.deltaTime) > i; i++) {
        if (this.isRunning) {
            this.step();
        }
    }
    this.deltaTime -= Math.floor(this.deltaTime);
  }

  loadRegister(addr, val) {
    if (addr == 0) return;
    this.registers[addr & 0x07] = val & 0x0F; this.registerTexts[addr & 0x07].textContent = `${this.registerNames[addr & 0x07]}: ${val & 0x0F}`;
  }

  loadRegisterExternal(val) {
    this.registers[0] = val & 0x0F; this.registerTexts[0].textContent = `${this.registerNames[0]}: ${val & 0x0F}`;
  }

  readRegister(addr) {
    return (addr & 0x07) < 16 ? this.registers[addr & 0x07] : 0;
  }

  writePc(val) {
    this.pc = val & 0x0F;
    this.cpuJumped = true;
  }

  reset() {
    this.isRunning = false;
    this.pc = 0;
    this.registers.fill(0);
    byteCtx.fillStyle = "black"; byteCtx.fillRect(0,0,byte.width, byte.height);
    for (let i = 0; i < this.registerTexts.length; i++) this.registerTexts[i].textContent = `${this.registerNames[i]}: 0`;
    this.pcText.textContent = "PC: 0";
    this.cpuJumped = false;
  }

  step(isButton=false) {
    this.pcText.textContent = `PC: ${this.pc}`

    const instr = this.instructionMemory[this.pc] || "00";
    this.execute(instr);

    if (!this.cpuJumped && (!this.isHalting || isButton)) this.pc = (this.pc + 1) & 0x0F;
    else this.cpuJumped = false;
  }

  execute(instruction) {
    const s = String(instruction);
    if (s.length < 2) return;
    const opcode = s.substring(0,1);
    const operand = parseInt(s.substring(1,2),16) & 0x0F;

    const func = this.executions[opcode];
    if (func) func(operand);
    }

  toggle() {
    this.isRunning = !this.isRunning;
    this.isHalting = !this.isRunning;
  }
}

class Controller {
    constructor(cpu) {
        this.keysPressed = new Array(4).fill(false);
        this.keyBinds = ['F', 'D', 'S', 'A'];
        this.cpu = cpu;
    }

    update() {
        let output = 0;
        for (let i = 0; i < this.keysPressed.length; i++)
        {
            if (this.keysPressed[i]) output |= (1 << i) & 0x0F;
        }

        this.cpu.loadRegisterExternal(output);
    }

    keyDown(key) {
        for (let i = 0; i < this.keyBinds.length; i++) {
            if (key.toUpperCase() === this.keyBinds[i])
            {
                this.keysPressed[i] = true;
            }
        }
    }

    keyUp(key) {
        for (let i = 0; i < this.keyBinds.length; i++) {
            if (key.toUpperCase() === this.keyBinds[i])
            {
                this.keysPressed[i] = false;
            }
        }
    }
}

class LED {
    constructor(cpu, ctx) {
        this.context = ctx;
        this.cpu = cpu;
    }

    update() {
        this.drawValue(this.cpu.readRegister(7))
    }  

    drawValue(val) {
        for (let i = 0; i < 4; i++) {
            this.context.fillStyle = (val & (1 << i)) ? "red" : "black";
            this.context.fillRect((3 - i) * bitSize, 0, bitSize, bitSize);
        }
    }
}

let cpu
let controller;

function readFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        const lines = content.split(/\r?\n/);
        cpu = new CPU();
        controller = new Controller(cpu);
        cpu.start(lines);
        updateFrame();
    };
    reader.readAsText(file);
}

document.addEventListener("keydown", (e) => {
    controller.keyDown(e.key);
});

document.addEventListener("keyup", (e) => {
    controller.keyUp(e.key);
});

function updateFrame() {
    cpu.update(performance.now());
    controller.update();
    cpu.leds.update();

    requestAnimationFrame(updateFrame);
}
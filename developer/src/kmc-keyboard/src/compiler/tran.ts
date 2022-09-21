import { constants } from "@keymanapp/ldml-keyboard-constants";
import { Finl, FinlItem, GlobalSections, Tran, TranItem, TranItemFlags } from "../kmx/kmx-plus.js";
import LDMLKeyboardXMLSourceFile, { LKTransform, LKTransforms } from "../ldml-keyboard/ldml-keyboard-xml.js";
import CompilerCallbacks from "./callbacks.js";
import { SectionCompiler } from "./section-compiler.js";

type TransformCompilerType = 'simple' | 'final';

class TransformCompiler<T extends TransformCompilerType, TranBase extends Tran, TranItemBase extends TranItem> extends SectionCompiler {

  protected type: T;

  constructor(source: LDMLKeyboardXMLSourceFile, callbacks: CompilerCallbacks) {
    super(source, callbacks);
  }

  public validate(): boolean {
    let valid = true;
    // TODO-LDML: linting here should check for identical before+from, but this involves a double-parse which is ugly
    // TODO-LDML: unicodesets means that either we fully parse them and verify conflicting rules or the linting is imperfect
    return valid;
  }

  protected newTranItem(): TranItemBase {
    return null;
  }

  protected newTran(): TranBase {
    return null;
  }

  private compileTransform(sections: GlobalSections, transform: LKTransform): TranItemBase {
    let result = this.newTranItem();
    result.from = sections.elem.allocElementString(sections.strs, transform.from);
    result.to = sections.strs.allocString(transform.to);
    result.before = sections.elem.allocElementString(sections.strs, transform.before);
    result.flags = transform.error == 'fail' ? TranItemFlags.error : TranItemFlags.none;
    return result;
  }

  private compileTransforms(sections: GlobalSections, transforms: LKTransforms): TranBase {
    let result = this.newTran();

    if(transforms?.transform) {
      for(let transform of transforms.transform) {
        result.items.push(this.compileTransform(sections, transform));
      }
    }

    return result;
  }

  public compile(sections: GlobalSections): TranBase {
    for(let t of this.keyboard.transforms) {
      if(t.type == this.type) {
        return this.compileTransforms(sections, t);
      }
    }
    return this.newTran();
  }
}

export class TranCompiler extends TransformCompiler<'simple', Tran, TranItem> {
  constructor(source: LDMLKeyboardXMLSourceFile, callbacks: CompilerCallbacks) {
    super(source, callbacks);
    this.type = 'simple';
  }
  protected newTranItem(): TranItem {
    return new TranItem();
  }
  protected newTran(): Tran {
    return new Tran();
  }
  public get id() {
    return constants.section.tran;
  }
};

export class FinlCompiler extends TransformCompiler<'final', Finl, FinlItem> {
  constructor(source: LDMLKeyboardXMLSourceFile, callbacks: CompilerCallbacks) {
    super(source, callbacks);
    this.type = 'final';
  }
  protected newTranItem(): FinlItem {
    return new FinlItem();
  }
  protected newTran(): Finl {
    return new Finl();
  }
  public get id() {
    return constants.section.finl;
  }
};

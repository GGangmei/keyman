import { constants } from "@keymanapp/ldml-keyboard-constants";
import { KMXPlusData } from "../kmx-plus";
import { alloc_element_string, BUILDER_ELEM } from "./build-elem";
import { BUILDER_STRS } from "./build-strs";
import { BUILDER_SECTION } from "./builder-section";

/* ------------------------------------------------------------------
* ordr section
  ------------------------------------------------------------------ */

interface BUILDER_ORDR_ITEM {
  elements: number; //elem.string
  before: number; //elem.string
};

export interface BUILDER_ORDR extends BUILDER_SECTION {
 count: number;
 reserved: number;
 items: BUILDER_ORDR_ITEM[];
};

/**
* Builder for the 'ordr' section
*/
export function build_ordr(kmxplus: KMXPlusData, sect_strs: BUILDER_STRS, sect_elem: BUILDER_ELEM): BUILDER_ORDR {
 if(!kmxplus.ordr?.items.length) {
   return null;
 }

 let ordr: BUILDER_ORDR = {
   ident: constants.hex_section_id(constants.section.ordr),
   size: constants.length_ordr + constants.length_ordr_item * kmxplus.ordr.items.length,
   _offset: 0,
   count: kmxplus.ordr.items.length,
   reserved: 0,
   items: []
 };

 for(let item of kmxplus.ordr.items) {
   ordr.items.push({
    elements: alloc_element_string(sect_strs, sect_elem, item.elements),
    before: alloc_element_string(sect_strs, sect_elem, item.before)
   });
 }

 return ordr;
}

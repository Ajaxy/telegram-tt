export class VTTypes {
  private readonly hierarchy: string[] = [];

  constructor(types: readonly string[]) {
    this.hierarchy = [...(types || [])];
  }

  with(type: string): VTTypes {
    return new VTTypes([...this.hierarchy, type]);
  }

  getTypes(): readonly string[] {
    return this.hierarchy;
  }
}

// View transition types
export const VTT_RIGHT_COLUMN = new VTTypes(['rightColumn']);
export const VTT_RIGHT_PROFILE_AVATAR = VTT_RIGHT_COLUMN.with('profileAvatar');
export const VTT_RIGHT_PROFILE_EXPAND = VTT_RIGHT_PROFILE_AVATAR.with('profileExpand');
export const VTT_RIGHT_PROFILE_COLLAPSE = VTT_RIGHT_PROFILE_AVATAR.with('profileCollapse');

export const VTT_PROFILE_GIFTS = VTT_RIGHT_COLUMN.with('profileGifts');

export const VTT_CHAT_EXTRA = VTT_RIGHT_COLUMN.with('chatExtra');

export const VTT_PROFILE_BUSINESS_HOURS = VTT_CHAT_EXTRA.with('profileBusinessHours');
export const VTT_PROFILE_BUSINESS_HOURS_EXPAND = VTT_PROFILE_BUSINESS_HOURS.with('profileBusinessHoursExpand');
export const VTT_PROFILE_BUSINESS_HOURS_COLLAPSE = VTT_PROFILE_BUSINESS_HOURS.with('profileBusinessHoursCollapse');

export const VTT_PROFILE_NOTE = VTT_CHAT_EXTRA.with('profileNote');
export const VTT_PROFILE_NOTE_EXPAND = VTT_PROFILE_NOTE.with('profileNoteExpand');
export const VTT_PROFILE_NOTE_COLLAPSE = VTT_PROFILE_NOTE.with('profileNoteCollapse');

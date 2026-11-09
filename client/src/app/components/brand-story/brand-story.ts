import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STORE_INFO } from '../../data/store-info';
import { SettingsService } from '../../services/settings.service';
import { splitParagraphs } from '../../utils/text';

@Component({
  selector: 'app-brand-story',
  imports: [RouterLink],
  templateUrl: './brand-story.html',
})
export class BrandStory {
  private settingsService = inject(SettingsService);

  readonly store = STORE_INFO;
  readonly title = computed(() => this.settingsService.settings().storyTitle);
  readonly paragraphs = computed(() => splitParagraphs(this.settingsService.settings().storyBody));
}

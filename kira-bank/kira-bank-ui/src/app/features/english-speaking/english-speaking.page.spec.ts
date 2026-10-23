import {TestBed} from '@angular/core/testing';
import {englishTranslations} from '../../core/i18n/translations';
import {vietnameseTranslations} from '../../core/i18n/translations.vi';
import {ROADMAP, TRACKS} from './english-speaking.data';
import {EnglishSpeakingPage} from './english-speaking.page';
import {speakable} from './text-search';
import {InterviewDrill} from './interview-drill';
import {INTERVIEW_QUESTIONS, INTERVIEW_ROUNDS} from './interview-questions.data';

describe('English speaking content', () => {
  const english: Record<string, string> = englishTranslations;
  const vietnamese: Record<string, string> = vietnameseTranslations;

  it('ships English and Vietnamese labels for every tab, round and the menu', () => {
    const keys = [
      'shell.groupLearning', 'shell.englishSpeaking', 'route.englishSpeaking', 'english.title', 'english.drillRounds',
      ...TRACKS.map(track => `english.tab.${track.id}`),
      ...INTERVIEW_ROUNDS.map(round => `english.round.${round}`)
    ];
    for (const key of keys) {
      expect(english[key], key).toBeTruthy();
      expect(vietnamese[key], key).toBeTruthy();
    }
  });

  it('covers every PwC round with questions that have an answer', () => {
    for (const round of INTERVIEW_ROUNDS) {
      const questions = INTERVIEW_QUESTIONS.filter(item => item.round === round);
      expect(questions.length, `round ${round}`).toBeGreaterThanOrEqual(4);
      for (const item of questions) {
        expect(item.answer.length).toBeGreaterThan(0);
        expect(item.shortAnswer?.length, item.question).toBeGreaterThan(0);
        expect(item.shortAnswer!.length, item.question).toBeLessThan(item.answer.length);
      }
    }
  });

  it('has no duplicate tracks or questions and no empty phrases', () => {
    const ids = TRACKS.map(track => track.id);
    expect(new Set(ids).size).toBe(ids.length);
    const questions = INTERVIEW_QUESTIONS.map(item => item.question);
    expect(questions.filter((text, index) => questions.indexOf(text) !== index)).toEqual([]);
    for (const track of TRACKS) {
      for (const group of track.groups) {
        expect(group.phrases.length, `${track.id}: ${group.title.en}`).toBeGreaterThan(0);
        for (const phrase of group.phrases) expect(phrase.en && phrase.vi, `${track.id}: ${phrase.en}`).toBeTruthy();
      }
    }
  });

  it('links every track from at least one roadmap week', () => {
    const linked = new Set(ROADMAP.flatMap(week => week.tracks));
    expect(TRACKS.map(track => track.id).filter(id => !linked.has(id))).toEqual([]);
  });

  it('shows every track in exactly one tab group, with a label for each group', () => {
    const page = TestBed.createComponent(EnglishSpeakingPage).componentInstance;
    const tabs = page.tabGroups.flatMap(group => group.tabs);
    expect(new Set(tabs).size).toBe(tabs.length);
    expect([...tabs].sort()).toEqual([...TRACKS.map(track => track.id), 'roadmap', 'rewrite'].sort());
    for (const group of page.tabGroups) {
      expect(english[`english.tabGroup.${group.key}`], group.key).toBeTruthy();
      expect(vietnamese[`english.tabGroup.${group.key}`], group.key).toBeTruthy();
    }
  });

  it('renders group tabs and only the tracks of the active group, and follows roadmap links', () => {
    const fixture = TestBed.createComponent(EnglishSpeakingPage);
    const page = fixture.componentInstance;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const groupTabs = () => Array.from(element.querySelectorAll<HTMLButtonElement>('.group-tabs [role="tab"]'));
    const trackTabs = () => Array.from(element.querySelectorAll<HTMLButtonElement>('.track-tabs [role="tab"]'));
    expect(groupTabs().length).toBe(page.tabGroups.length);
    expect(trackTabs().length).toBe(page.tabGroups[0].tabs.length);
    element.querySelectorAll('[role="tablist"]').forEach(list => expect(list.getAttribute('aria-label')).not.toMatch(/^english\./));

    const domain = page.tabGroups.find(group => group.key === 'domain')!;
    groupTabs()[page.tabGroups.indexOf(domain)].click();
    fixture.detectChanges();
    expect(page.tab()).toBe(domain.tabs[0]);
    expect(trackTabs().length).toBe(domain.tabs.length);

    trackTabs().find(tab => tab.textContent?.includes(english['english.tab.fintech']))!.click();
    fixture.detectChanges();
    expect(element.querySelector('.track-tabs [aria-selected="true"]')?.textContent).toContain(english['english.tab.fintech']);
    expect(element.textContent).toContain('Cards and statements');

    page.tab.set('livecoding');
    fixture.detectChanges();
    expect(page.activeGroup().key).toBe('interview');
    expect(element.querySelector('.group-tabs [aria-selected="true"]')?.textContent).toContain(english['english.tabGroup.interview']);
  });

  it('uses key phrases that actually appear in each model answer', () => {
    const missing = INTERVIEW_QUESTIONS.flatMap(item => item.keyPhrases
      .filter(phrase => !item.answer.toLowerCase().includes(phrase.toLowerCase()))
      .map(phrase => `${item.question} → ${phrase}`));
    expect(missing).toEqual([]);
  });

  it('loads the deferred interview drill when the interview tab opens', async () => {
    const fixture = TestBed.createComponent(EnglishSpeakingPage);
    fixture.componentInstance.tab.set('interview');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-interview-drill')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(english['english.drillRounds']);
  });

  it('keeps arrows out of text that is read aloud', () => {
    const spoken = TRACKS.flatMap(track => [
      ...track.groups.flatMap(group => group.phrases.map(phrase => phrase.en)),
      ...track.templates.map(template => template.body)
    ]);
    expect(spoken.filter(text => /[→←↗↘]| \/ /.test(text))).toEqual([]);
    // Template bodies are read in full, and TTS says "slash" for " / ".
    expect(TRACKS.flatMap(track => track.templates.map(template => template.body)).filter(body => / \/ |\bvs\b/.test(body))).toEqual([]);
  });

  it('offers five distinct unpractised phrases for today and drops one once practised', () => {
    const page = TestBed.createComponent(EnglishSpeakingPage).componentInstance;
    page.done.set(new Set());
    const today = page.todayPhrases();
    expect(today.length).toBe(5);
    expect(new Set(today.map(item => item.id)).size).toBe(5);
    page.toggle(today[0].id);
    expect(page.todayPhrases().map(item => item.id)).not.toContain(today[0].id);
    page.toggle(today[0].id);
  });

  it('hides English in recall mode until a phrase is revealed', () => {
    const fixture = TestBed.createComponent(EnglishSpeakingPage);
    const page = fixture.componentInstance;
    page.tab.set('office');
    page.toggleRecall();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const first = TRACKS.find(track => track.id === 'office')!.groups[0].phrases[0];
    expect(element.textContent).not.toContain(first.en);
    expect(element.textContent).toContain(first.vi);

    element.querySelector<HTMLButtonElement>('.reveal')!.click();
    fixture.detectChanges();
    expect(element.textContent).toContain(first.en);

    page.toggleRecall();
    expect(page.revealed().size).toBe(0);
  });

  it('keeps code operators out of interview text that is read aloud', () => {
    const spoken = INTERVIEW_QUESTIONS.flatMap(item => [item.question, item.answer, item.shortAnswer ?? '']);
    expect(spoken.filter(text => /\+\+|>=|<=|!=|==|&&|\|\|| \/ /.test(text))).toEqual([]);
  });

  it('counts practised phrases and interview questions separately', () => {
    const page = TestBed.createComponent(EnglishSpeakingPage).componentInstance;
    page.done.set(new Set([page.phraseIds[0], page.phraseIds[1], 'q:Explain ACID properties.', 'week.1.0']));
    expect(page.phrasesDone()).toBe(2);
    expect(page.questionsDone()).toBe(1);
  });

  it('searches every phrase, ignoring Vietnamese accents', () => {
    const fixture = TestBed.createComponent(EnglishSpeakingPage);
    const page = fixture.componentInstance;
    page.phraseQuery.set('tre mot tuan');
    expect(page.phraseResults().length).toBeGreaterThan(0);
    expect(page.phraseResults().every(item => item.phrase.vi.toLowerCase().includes('trễ một tuần'))).toBe(true);
    page.phraseQuery.set('deadline');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.search-results li').length).toBe(page.phraseResults().length);
    page.phraseQuery.set('x');
    expect(page.phraseResults()).toEqual([]);
  });

  it('reads placeholders and "vs" naturally', () => {
    expect(speakable('HashMap vs ConcurrentHashMap')).toBe('HashMap versus ConcurrentHashMap');
    expect(speakable('On [project name], we chose it.')).toBe('On project name, we chose it.');
    expect(speakable('canvas')).toBe('canvas');
  });

  it('filters the drill by round and clears the round when a category is picked', async () => {
    await TestBed.configureTestingModule({imports: [InterviewDrill]}).compileComponents();
    const fixture = TestBed.createComponent(InterviewDrill);
    fixture.componentRef.setInput('speak', () => undefined);
    const drill = fixture.componentInstance;

    drill.selectRound(2);
    expect(drill.questions().map(item => item.question)).toContain('synchronized vs volatile');
    expect(drill.questions().every(item => item.round === 2)).toBe(true);
    expect(drill.category()).toBeNull();

    drill.index.set(1);
    drill.random();
    expect(drill.index()).not.toBe(1);
    expect(drill.index()).toBeLessThan(drill.questions().length);

    drill.find('phong tranh');
    expect(drill.questions().length).toBeGreaterThan(0);
    drill.find('deadlock');
    expect(drill.questions().length).toBeGreaterThan(0);
    expect(drill.questions().every(item => item.round === 2 && /deadlock/i.test(item.question + item.questionVi))).toBe(true);
    expect(drill.index()).toBe(0);
    drill.find('');

    const emitted: string[] = [];
    drill.toggleDone.subscribe(id => emitted.push(id));
    drill.find('');
    drill.selectRound(4);
    fixture.componentRef.setInput('done', new Set([drill.questionId(drill.questions()[0])]));
    expect(drill.roundProgress(4)).toBe(`1/${drill.questions().length}`);
    fixture.detectChanges();
    const markButton = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find(button => button.textContent?.includes(english['english.markPractised']))!;
    expect(markButton.getAttribute('aria-pressed')).toBe('true');
    markButton.click();
    expect(emitted).toEqual(['q:' + drill.questions()[0].question]);

    drill.revealed.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(drill.current()!.answer);
    drill.answerShown.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(drill.current()!.answer);
    drill.step(1);
    expect(drill.answerShown()).toBe(false);

    drill.select('SPRING');
    expect(drill.round()).toBeNull();
    expect(drill.questions().every(item => item.category === 'SPRING')).toBe(true);
  });
});

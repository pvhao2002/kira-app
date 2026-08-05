import { capabilities, experience, projects, rooms } from './data';

export function StaticOverview({ onExplore }: { onExplore: () => void }) {
  return <main className="static-overview">
    <header className="static-lead"><h1>A portfolio you can walk through.</h1><p>Prefer a quieter visit? Here is the complete portfolio without the interactive house.</p><button className="explore-button" type="button" onClick={onExplore}>Explore the house</button></header>
    <section className="static-room"><h2>Projects</h2><div className="project-list">{projects.map((project, index) => <article className="project-row" key={project.title}><span className="project-number">0{index + 1}</span><div><h3>{project.title}</h3><p>{project.description}</p></div><span className="stack">{project.stack.join(' · ')}</span></article>)}</div></section>
    <section className="static-room"><h2>Experience</h2><div className="timeline">{experience.map((item) => <article className="timeline-row" key={item.year}><span className="timeline-year">{item.year}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div></section>
    <section className="static-room"><h2>About</h2><p>I build reliable systems that make demanding work more understandable. The approach is technical, calm, and centered on the people using the tools.</p><div className="capabilities">{capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></section>
    <section className="static-room"><h2>Contact</h2><p>{rooms.find((room) => room.id === 'contact')!.summary}</p><a className="static-link" href="mailto:hello@kirapham.dev">hello@kirapham.dev ↗</a></section>
  </main>;
}

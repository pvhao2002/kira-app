import { capabilities, experience, projects, rooms } from './data';
import type { RoomId } from './types';

export function RoomDetail({ room, onBack }: { room: RoomId; onBack: () => void }) {
  const detail = rooms.find((item) => item.id === room)!;
  return (
    <section className="room-detail" id={room} aria-labelledby={`${room}-heading`}>
      <div className="room-intro">
        <span className="room-index">Selected room: {detail.label}</span>
        <h2 id={`${room}-heading`}>{detail.label}</h2>
        <p>{detail.summary}</p>
        <button className="back-button" type="button" onClick={onBack}>← Back to house</button>
      </div>
      <div className="room-content">{room === 'projects' && <Projects />}{room === 'experience' && <Experience />}{room === 'about' && <About />}{room === 'contact' && <Contact />}</div>
    </section>
  );
}

function Projects() {
  return <div className="project-list">{projects.map((project, index) => <article className="project-row" key={project.title}>
    <span className="project-number">0{index + 1}</span><div><h3>{project.title}</h3><p>{project.description}</p></div>
    <div className="stack">{project.stack.map((item) => <div key={item}>{item}</div>)}<a className="detail-link" href={project.href}>View project ↗</a></div>
  </article>)}</div>;
}

function Experience() {
  return <div className="timeline">{experience.map((item) => <article className="timeline-row" key={item.year}><span className="timeline-year">{item.year}</span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div>;
}

function About() {
  return <div className="about-copy"><p>I enjoy turning complex requirements into clear systems. My practice sits between careful engineering, useful interfaces, and the small operational details that make a product dependable.</p><div className="capabilities">{capabilities.map((capability) => <span key={capability}>{capability}</span>)}</div></div>;
}

function Contact() {
  return <div className="contact-list"><article className="contact-row"><div><h3>Email</h3><p>For new work, collaboration, or a good technical question.</p></div><a href="mailto:hello@kirapham.dev">hello@kirapham.dev ↗</a></article><article className="contact-row"><div><h3>GitHub</h3><p>Selected code and experiments.</p></div><a href="https://github.com/" target="_blank" rel="noreferrer">github.com/kirapham ↗</a></article><article className="contact-row"><div><h3>LinkedIn</h3><p>A more traditional way to connect.</p></div><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer">linkedin.com/in/kirapham ↗</a></article></div>;
}

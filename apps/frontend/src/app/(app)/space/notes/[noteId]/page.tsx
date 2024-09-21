"use client"

import { useState, useRef, useEffect } from "react"

import { Icon } from "@iconify-icon/react/dist/iconify.mjs"
import { PlusIcon } from "@radix-ui/react-icons"
import Link from "next/link"

import TextEditor from "@/src/components/atoms/Editor"
import { useAuth } from "@/src/contexts/AuthContext"
import useEditorHook from "@/src/hooks/useEditor.hook"
import { type Note } from "@/src/lib/@types/Items/Note"
import { redirectNote } from "@/src/lib/server/actions/redirectNote"
import useNotesStore from "@/src/lib/store/notes.store"
import classNames from "@/src/utils/classNames"
import { formatDateYear } from "@/src/utils/datetime"

const NotesPage: React.FC = ({ params }: { params: { noteId: string } }) => {
  const { session } = useAuth()
  const { fetchNotes, notes, getNoteByuuid, addNote, saveNote, deleteNote } =
    useNotesStore()

  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState(note?.title ?? "")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [content, setContent] = useState(note?.content ?? "<p></p>")
  const [isSaved, setIsSaved] = useState(true)
  const editor = useEditorHook({ content, setContent, setIsSaved })

  const [loading, setLoading] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [closeToggle, setCloseToggle] = useState(false)
  const [titleDebounceTimer, setTitleDebounceTimer] =
    useState<NodeJS.Timeout | null>(null)

  const handleClose = () => setCloseToggle(!closeToggle)

  const handleTitle = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTitle(e.target.value)

    if (titleDebounceTimer) {
      clearTimeout(titleDebounceTimer)
    }

    const newTimer = setTimeout(() => {
      if (note !== null) {
        saveNoteToServer({ ...note, title, content })
        setIsSaved(true)
      }
    }, 2000)

    setTitleDebounceTimer(newTimer)
    setIsSaved(false)
  }

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }, [title])

  const fetchTheNotes = async (): Promise<void> => {
    await fetchNotes(session)
  }

  const getNote = async (): Promise<Note | null> => {
    try {
      const note = await getNoteByuuid(session, params.noteId)
      if (note) {
        setNote(note)
        setTitle(note.title)
        setContent(note.content)
      } else {
        setNotFound(true)
      }
      return note
    } catch (error) {
      console.error(error)
      return null
    }
  }

  useEffect(() => {
    getNote()
    fetchTheNotes()
  }, [])

  useEffect(() => {
    if (note !== null) {
      editor?.setEditable(true)
      editor?.commands.setContent(note.content)
    }
  }, [note])

  const addNewNote = async (): Promise<void> => {
    try {
      setLoading(true)
      const newNote = await addNote(session, "", "<p></p>")
      if (newNote !== null) {
        redirectNote(newNote.uuid)
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const saveNoteToServer = async (note: Note): Promise<void> => {
    await saveNote(session, note)
  }

  const handleDeleteNote = (n: Note): void => {
    if (session && n) {
      try {
        deleteNote(session, n)
        const remainingNotes = notes.filter((n_) => n_.uuid !== n.uuid)
        if (n.uuid === note?.uuid) {
          if (remainingNotes.length <= 0) {
            addNewNote()
            return
          }
          redirectNote(remainingNotes[0].uuid)
        }
      } catch (error) {
        console.error(error)
      }
    }
  }

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSaved) {
        e.preventDefault()
        e.returnValue = ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isSaved])

  return (
    <div className="flex size-full gap-16 bg-background p-16">
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-4">
        <div className="flex w-full items-center justify-between text-sm text-secondary-foreground">
          <div className="flex gap-4">
            {note !== null && (
              <p className="flex items-center">
                {formatDateYear(note.createdAt)}
              </p>
            )}
            {!loading ? (
              <button
                onClick={addNewNote}
                className="flex items-center gap-1 truncate rounded-md px-1 text-secondary-foreground hover:bg-secondary"
              >
                <PlusIcon />
                <span>Add A New Note</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 rounded-md px-1 text-secondary-foreground hover:bg-secondary">
                <span>loading...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 cursor-default">
            {!isSaved ? <span>...</span> : <span>saved</span>}
            <button
              className="flex items-center hover:text-secondary"
              onClick={handleClose}
            >
              <Icon icon="basil:stack-solid" style={{ fontSize: "15px" }} />
            </button>
          </div>
        </div>
        {note !== null ? (
          <div
            onBlur={() => {
              saveNoteToServer({ ...note, title, content })
            }}
          >
            <textarea
              ref={textareaRef}
              value={title}
              onChange={handleTitle}
              placeholder="Untitled"
              className="w-full text-3xl py-2 bg-background text-foreground font-bold placeholder:text-secondary-foreground resize-none overflow-hidden outline-none focus:outline-none whitespace-pre-wrap break-words truncate"
              rows={1}
            />
            <TextEditor editor={editor} />
          </div>
        ) : notFound ? (
          <div className="mt-4 text-secondary-foreground">
            <p>note not found</p>
          </div>
        ) : (
          <div className="mt-4 text-secondary-foreground">
            <p>loading...</p>
          </div>
        )}
      </div>
      <div
        className={classNames(
          closeToggle ? "hidden" : "visible",
          "w-full max-h-screen max-w-[200px] flex flex-col gap-8 overflow-y-auto text-secondary-foreground text-sm"
        )}
      >
        <span className="text-foreground">notes</span>
        <div className="flex flex-col gap-2 px-2">
          {notes?.map((n) => (
            <div
              key={n.uuid}
              className="flex items-center justify-between gap-1 py-1 px-2 rounded-md hover:bg-secondary truncate group"
            >
              <Link href={`/space/notes/${n.uuid}`} className="flex-1 truncate">
                {n.uuid === note?.uuid ? (
                  <p className="text-foreground truncate">
                    {title || "Untitled"}
                  </p>
                ) : (
                  <p className="text-secondary-foreground truncate">
                    {n.title || "Untitled"}
                  </p>
                )}
              </Link>
              <button
                className="hover:text-secondary opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteNote(n)
                }}
              >
                del
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default NotesPage

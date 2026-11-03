import { Coffee } from "lucide-react"
import { ButtonLink } from "../components/ui"

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="grid size-20 place-items-center rounded-full bg-[#eee6dc] text-[#5d4033]">
        <Coffee size={34} />
      </span>
      <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#806857]">
        Lỗi 404
      </p>
      <h1 className="mt-2 font-serif text-5xl text-[#302018]">Trang này đã nguội mất rồi.</h1>
      <p className="mt-4 max-w-md leading-7 text-[#78655a]">
        Có vẻ đường dẫn bạn tìm không tồn tại. Về menu để chọn một ly mới nhé.
      </p>
      <ButtonLink to="/" className="mt-7">
        Về trang chủ
      </ButtonLink>
    </section>
  )
}

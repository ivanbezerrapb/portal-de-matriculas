import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createUser, deleteUser, listUsers, setUserRole } from "@/lib/ext/usuarios.functions";
import { listSchools } from "@/lib/ext/escolas.functions";
import { ROLE_LABELS } from "@/lib/ext/model";
import { Badge, Button, Card, Input, Label, Select, Spinner } from "@/components/ui";

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({
    meta: [
      { title: "Usuários — Grupo Inter" },
      { name: "description", content: "Gerencie usuários e permissões por escola." },
      { property: "og:title", content: "Usuários — Grupo Inter" },
      { property: "og:description", content: "Gerencie usuários e permissões por escola." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

type Role = "admin" | "school_manager" | "print_operator" | "info_center";
const ROLES = Object.entries(ROLE_LABELS) as [Role, string][];
const NEEDS_SCHOOL: Role[] = ["school_manager", "print_operator", "info_center"];

function UsersPage() {
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listUsers(),
  });
  const { data: schools } = useQuery({
    queryKey: ["schools"],
    queryFn: () => listSchools(),
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("print_operator");
  const [schoolId, setSchoolId] = useState("");
  const [addRoleFor, setAddRoleFor] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<Role>("print_operator");
  const [newRoleSchool, setNewRoleSchool] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterRole, setFilterRole] = useState<Role | "all">("all");
  const [filterSchool, setFilterSchool] = useState("all");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const createMut = useMutation({
    mutationFn: () =>
      createUser({
        data: {
          email,
          password,
          full_name: fullName,
          role,
          ...(NEEDS_SCHOOL.includes(role) && schoolId ? { school_id: schoolId } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Usuário criado.");
      setEmail("");
      setPassword("");
      setFullName("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (vars: {
      user_id: string;
      role: Role;
      school_id: string | null;
      action: "add" | "remove";
    }) => setUserRole({ data: vars }),
    onSuccess: () => {
      toast.success("Permissões atualizadas.");
      setAddRoleFor(null);
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { user_id: userId } }),
    onSuccess: () => {
      toast.success("Usuário excluído.");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const schoolName = (id: string | null) => schools?.find((s) => s.id === id)?.name ?? "";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold text-foreground">Usuários</h1>

      <Card className="mt-6">
        <h2 className="font-semibold text-foreground">Novo usuário</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (NEEDS_SCHOOL.includes(role) && !schoolId) {
              toast.error("Selecione a escola para este perfil.");
              return;
            }
            createMut.mutate();
          }}
        >
          <div>
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>Senha inicial</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div>
            <Label>Perfil</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {ROLES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          {NEEDS_SCHOOL.includes(role) && (
            <div>
              <Label>Escola</Label>
              <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">Selecione...</option>
                {(schools ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="flex items-end">
            <Button type="submit" disabled={createMut.isPending}>
              Criar usuário
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {(users ?? []).map((u) => (
            <Card key={u.id}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{u.full_name || u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setAddRoleFor(addRoleFor === u.id ? null : u.id)}
                >
                  + Perfil
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Excluir o usuário ${u.email}?`)) {
                      deleteMut.mutate(u.id);
                    }
                  }}
                >
                  Excluir
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {u.roles.length === 0 && (
                  <span className="text-sm text-muted-foreground">Sem perfil atribuído</span>
                )}
                {u.roles.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-2">
                    <Badge color="muted">
                      {ROLE_LABELS[r.role] ?? r.role}
                      {r.school_id ? ` · ${schoolName(r.school_id)}` : ""}
                    </Badge>
                    <button
                      className="text-xs text-destructive hover:underline"
                      onClick={() =>
                        roleMut.mutate({
                          user_id: u.id,
                          role: r.role as Role,
                          school_id: r.school_id,
                          action: "remove",
                        })
                      }
                    >
                      remover
                    </button>
                  </span>
                ))}
              </div>

              {addRoleFor === u.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-muted p-3">
                  <div>
                    <Label>Perfil</Label>
                    <Select value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
                      {ROLES.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {NEEDS_SCHOOL.includes(newRole) && (
                    <div>
                      <Label>Escola</Label>
                      <Select
                        value={newRoleSchool}
                        onChange={(e) => setNewRoleSchool(e.target.value)}
                      >
                        <option value="">Selecione...</option>
                        {(schools ?? []).map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                  <Button
                    variant="secondary"
                    onClick={() => {
                      if (NEEDS_SCHOOL.includes(newRole) && !newRoleSchool) {
                        toast.error("Selecione a escola.");
                        return;
                      }
                      roleMut.mutate({
                        user_id: u.id,
                        role: newRole,
                        school_id: NEEDS_SCHOOL.includes(newRole) ? newRoleSchool : null,
                        action: "add",
                      });
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
